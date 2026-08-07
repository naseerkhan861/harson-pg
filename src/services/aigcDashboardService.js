"use strict";

const aigcAccountModel = require(
  "../models/aigcAccountCsvModel"
);

const taskSnapshotModel = require(
  "../models/aigcTaskSnapshotCsvModel"
);

const masterOwnerModel = require(
  "../models/aigcMasterOwnerCsvModel"
);

const masterProviderConfigModel = require(
  "../models/aigcMasterProviderConfigCsvModel"
);

function toNonNegativeNumber(value) {
  const numericValue = Number(value);

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0
  ) {
    return 0;
  }

  return numericValue;
}

function percentage(value, total) {
  if (total <= 0) {
    return 0;
  }

  return Number(
    (
      value /
      total *
      100
    ).toFixed(2)
  );
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function taskDateKey(task) {
  const value = String(
    task?.dateEnd ||
    task?.dateCreate ||
    task?.syncedAt ||
    ""
  ).trim();

  const datePrefix = value.match(
    /^(\d{4}-\d{2}-\d{2})/
  );

  if (datePrefix) {
    return datePrefix[1];
  }

  const parsedDate = new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "";
  }

  return formatDateKey(parsedDate);
}

function latestValue(values) {
  return values.reduce(
    (latest, value) => {
      const normalizedValue =
        String(value || "").trim();

      return normalizedValue > latest
        ? normalizedValue
        : latest;
    },
    ""
  ) || null;
}

function buildWeeklyTrend(
  tasks,
  now = new Date()
) {
  const dailyUsage = new Map();

  tasks.forEach(task => {
    const key = taskDateKey(task);

    if (!key) {
      return;
    }

    dailyUsage.set(
      key,
      (
        dailyUsage.get(key) || 0
      ) +
      toNonNegativeNumber(
        task.netPoint
      )
    );
  });

  const days = [];

  for (
    let offset = 6;
    offset >= 0;
    offset -= 1
  ) {
    const date = new Date(now);

    date.setHours(0, 0, 0, 0);
    date.setDate(
      date.getDate() - offset
    );

    const key = formatDateKey(date);

    days.push({
      date: key,
      label:
        `${date.getMonth() + 1}/${date.getDate()}`,
      tokens:
        dailyUsage.get(key) || 0
    });
  }

  return days;
}

function summarizeTasks(tasks) {
  const deductedTokens =
    tasks.reduce(
      (total, task) =>
        total +
        toNonNegativeNumber(
          task.point
        ),
      0
    );

  const refundedTokens =
    tasks.reduce(
      (total, task) =>
        total +
        toNonNegativeNumber(
          task.refundedPoint
        ),
      0
    );

  return {
    totalTasks: tasks.length,

    successfulTasks:
      tasks.filter(task =>
        task.status === "O"
      ).length,

    failedTasks:
      tasks.filter(task =>
        task.status === "R"
      ).length,

    processingTasks:
      tasks.filter(task =>
        task.status !== "O" &&
        task.status !== "R"
      ).length,

    deductedTokens,
    refundedTokens,

    netUsedTokens:
      Math.max(
        deductedTokens -
        refundedTokens,
        0
      )
  };
}

function toDashboardTask(task) {
  return {
    id:
      task.providerTaskId,

    title:
      task.objectName ||
      "AIGC 创作任务",

    type:
      task.object || "",

    status:
      task.status || "",

    deductedTokens:
      toNonNegativeNumber(
        task.point
      ),

    refundedTokens:
      toNonNegativeNumber(
        task.refundedPoint
      ),

    netUsedTokens:
      Number(task.netPoint || 0),

    createdAt:
      task.dateCreate || "",

    completedAt:
      task.dateEnd || ""
  };
}

function createMasterAnalytics({
  master,
  ownerMapping
}) {
  const providerConfig =
    masterProviderConfigModel
      .getProviderConfigByMasterAccountId(
        master.id
      );

  const providerMemberId =
    String(
      providerConfig
        ?.providerMemberId ||
      ""
    ).trim();

  const snapshot =
    providerMemberId
      ? (() => {
          const tasks =
            taskSnapshotModel
              .listTasksByMemberId({
                masterAccountId:
                  master.id,

                memberId:
                  providerMemberId
              });

          return {
            status: "resolved",

            memberId:
              providerMemberId,

            tasks,

            summary:
              summarizeTasks(tasks),

            latestSyncedAt:
              latestValue(
                tasks.map(task =>
                  task.syncedAt
                )
              )
          };
        })()
      : taskSnapshotModel
          .listTaskSnapshotByIdentity({
            masterAccountId:
              master.id,

            identities: [
              providerConfig
                ?.providerAccount,
              master.platformLogin,
              ownerMapping
                ?.clBaseEmail
            ]
          });

  const summary =
    snapshot.summary ||
    summarizeTasks([]);

  return {
    id:
      `master:${master.id}`,

    accountType:
      "master",

    masterAccountId:
      master.id,

    enterpriseName:
      master.enterpriseName ||
      "未命名企业",

    name:
      "企业主账号",

    status:
      snapshot.status,

    memberId:
      snapshot.memberId,

    deductedTokens:
      toNonNegativeNumber(
        summary.deductedTokens
      ),

    refundedTokens:
      toNonNegativeNumber(
        summary.refundedTokens
      ),

    netUsedTokens:
      toNonNegativeNumber(
        summary.netUsedTokens
      ),

    totalTasks:
      toNonNegativeNumber(
        summary.totalTasks
      ),

    successfulTasks:
      toNonNegativeNumber(
        summary.successfulTasks
      ),

    failedTasks:
      toNonNegativeNumber(
        summary.failedTasks
      ),

    processingTasks:
      toNonNegativeNumber(
        summary.processingTasks
      ),

    latestSyncedAt:
      snapshot.latestSyncedAt,

    tasks:
      snapshot.tasks || []
  };
}

function createAccountAnalytics({
  master,
  subAccount,
  mapping
}) {
  const snapshot =
    taskSnapshotModel
      .listTaskSnapshotByIdentity({
        masterAccountId:
          master.id,

        identities: [
          subAccount.platformLogin,
          subAccount.subAccountName,
          mapping?.clBaseEmail
        ]
      });

  const tokenLimit =
    toNonNegativeNumber(
      subAccount.tokenLimit
    );

  const deductedTokens =
    toNonNegativeNumber(
      snapshot.summary
        ?.deductedTokens
    );

  const refundedTokens =
    toNonNegativeNumber(
      snapshot.summary
        ?.refundedTokens
    );

  const netUsedTokens =
    toNonNegativeNumber(
      snapshot.summary
        ?.netUsedTokens
    );

  const remainingTokens =
    Math.max(
      tokenLimit -
      netUsedTokens,
      0
    );

  return {
    id:
      subAccount.id,

    masterAccountId:
      master.id,

    enterpriseName:
      master.enterpriseName ||
      "未命名企业",

    name:
      subAccount.subAccountName ||
      "未命名子账号",

    accountType:
      "sub",

    status:
      snapshot.status,

    memberId:
      snapshot.memberId,

    tokenLimit,
    deductedTokens,
    refundedTokens,
    netUsedTokens,
    remainingTokens,

    usageRate:
      percentage(
        netUsedTokens,
        tokenLimit
      ),

    totalTasks:
      toNonNegativeNumber(
        snapshot.summary
          ?.totalTasks
      ),

    successfulTasks:
      toNonNegativeNumber(
        snapshot.summary
          ?.successfulTasks
      ),

    failedTasks:
      toNonNegativeNumber(
        snapshot.summary
          ?.failedTasks
      ),

    processingTasks:
      toNonNegativeNumber(
        snapshot.summary
          ?.processingTasks
      ),

    latestSyncedAt:
      snapshot.latestSyncedAt,

    tasks:
      snapshot.tasks || []
  };
}

function removeDuplicateMemberMatches(
  accounts
) {
  const memberCounts = new Map();

  accounts.forEach(account => {
    if (!account.memberId) {
      return;
    }

    const memberKey = [
      account.masterAccountId,
      account.memberId
    ].join(":");

    memberCounts.set(
      memberKey,
      (
        memberCounts.get(
          memberKey
        ) || 0
      ) + 1
    );
  });

  return accounts.map(account => {
    const memberKey = [
      account.masterAccountId,
      account.memberId
    ].join(":");

    if (
      !account.memberId ||
      memberCounts.get(
        memberKey
      ) === 1
    ) {
      return account;
    }

    return {
      ...account,
      status:
        "member_ambiguous",
      memberId: null,
      deductedTokens: 0,
      refundedTokens: 0,
      netUsedTokens: 0,
      remainingTokens:
        account.tokenLimit,
      usageRate: 0,
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      processingTasks: 0,
      tasks: []
    };
  });
}

function toSafeAccount(account) {
  const safeAccount = {
    ...account,

    tasks:
      (account.tasks || [])
        .map(toDashboardTask)
  };

  delete safeAccount.memberId;

  return safeAccount;
}

function buildDashboardAnalytics({
  masterAccountIds = [],
  scope = "master_owner",
  now = new Date()
} = {}) {
  const requestedIds = new Set(
    masterAccountIds
      .map(value =>
        String(value || "").trim()
      )
      .filter(Boolean)
  );

  const data =
    aigcAccountModel
      .listAdminData();

  const availableMasters =
    data.masters.filter(master =>
      master.status === "active"
    );

  const masters =
    requestedIds.size > 0
      ? availableMasters.filter(master =>
          requestedIds.has(
            String(master.id)
          )
        )
      : availableMasters;

  if (
    requestedIds.size > 0 &&
    masters.length !==
      requestedIds.size
  ) {
    throw new Error(
      "未找到可用的 AIGC 企业主账号"
    );
  }

  const masterIdSet = new Set(
    masters.map(master =>
      String(master.id)
    )
  );

  const activeMappings =
    data.mappings.filter(mapping =>
      mapping.mappingStatus ===
        "active" &&
      masterIdSet.has(
        String(
          mapping.masterAccountId
        )
      )
    );

  const ownerMappings =
    masterOwnerModel
      .listActiveMappings();

  const rawMasterAccounts =
    masters.map(master =>
      createMasterAnalytics({
        master,

        ownerMapping:
          ownerMappings.find(item =>
            String(
              item.masterAccountId
            ) ===
              String(master.id)
          ) || null
      })
    );

  const rawAccounts = [];

  masters.forEach(master => {
    data.subs
      .filter(subAccount =>
        subAccount.status ===
          "active" &&
        String(
          subAccount.masterAccountId
        ) === String(master.id)
      )
      .forEach(subAccount => {
        const mapping =
          activeMappings.find(item =>
            String(
              item.aigcSubAccountId
            ) ===
              String(subAccount.id)
          ) || null;

        rawAccounts.push(
          createAccountAnalytics({
            master,
            subAccount,
            mapping
          })
        );
      });
  });

  const resolvedAccounts =
    removeDuplicateMemberMatches(
      [
        ...rawMasterAccounts,
        ...rawAccounts
      ]
    );

  const masterAccounts =
    resolvedAccounts.filter(
      account =>
        account.accountType ===
        "master"
    );

  const accounts =
    resolvedAccounts.filter(
      account =>
        account.accountType ===
        "sub"
    );

  const uniqueTasks = new Map();

  masters.forEach(master => {
    taskSnapshotModel
      .listTasksByMasterAccountId(
        master.id
      )
      .forEach(task => {
      uniqueTasks.set(
        [
          master.id,
          task.providerTaskId
        ].join(":"),
        task
      );
    });
  });

  const allTasks =
    Array.from(
      uniqueTasks.values()
    );

  const companyTaskSummary =
    summarizeTasks(allTasks);

  const netUsedTokens =
    companyTaskSummary
      .netUsedTokens;

  const comparisonAccounts = [
    ...masterAccounts,
    ...accounts
  ];

  const assignedTaskKeys =
    new Set(
      comparisonAccounts.flatMap(
        account =>
          (account.tasks || [])
            .map(task =>
              [
                account.masterAccountId,
                task.providerTaskId
              ].join(":")
            )
      )
    );

  const unassignedTasks =
    allTasks.filter(task =>
      !assignedTaskKeys.has(
        [
          task.masterAccountId,
          task.providerTaskId
        ].join(":")
      )
    );

  const unassignedSummary =
    summarizeTasks(
      unassignedTasks
    );

  const safeAccounts =
    accounts.map(toSafeAccount);

  const safeMasterAccounts =
    masterAccounts.map(
      toSafeAccount
    );

  const safeComparisonAccounts =
    comparisonAccounts.map(account => ({
      id: account.id,
      accountType:
        account.accountType,
      masterAccountId:
        account.masterAccountId,
      name:
        account.name,
      netUsedTokens:
        account.netUsedTokens,
      sharePercent:
        percentage(
          account.netUsedTokens,
          netUsedTokens
        )
    }));

  if (unassignedTasks.length > 0) {
    safeComparisonAccounts.push({
      id: "unassigned",
      accountType: "unassigned",
      masterAccountId: "",
      name: "未归属账号",
      netUsedTokens:
        unassignedSummary
          .netUsedTokens,
      sharePercent:
        percentage(
          unassignedSummary
            .netUsedTokens,
          netUsedTokens
        )
    });
  }

  const latestSyncedAt =
    latestValue(
      masters.flatMap(master =>
        taskSnapshotModel
          .listTasksByMasterAccountId(
            master.id
          )
          .map(task =>
            task.syncedAt
          )
      )
    );

  return {
    scope,

    generatedAt:
      now.toISOString(),

    latestSyncedAt,

    enterpriseName:
      masters.length === 1
        ? masters[0]
            .enterpriseName ||
          "未命名企业"
        : "全部企业",

    masters:
      (
        scope === "admin"
          ? availableMasters
          : masters
      ).map(master => ({
        id: master.id,
        enterpriseName:
          master.enterpriseName ||
          "未命名企业"
      })),

    selectedMasterAccountIds:
      masters.map(master =>
        master.id
      ),

    summary: {
      currentBalance:
        masters.reduce(
          (total, master) =>
            total +
            toNonNegativeNumber(
              master.totalCredits
            ),
          0
        ),

      allocatedTokens:
        accounts.reduce(
          (total, account) =>
            total +
            account.tokenLimit,
          0
        ),

      netUsedTokens,

      remainingTokens:
        accounts.reduce(
          (total, account) =>
            total +
            account.remainingTokens,
          0
        ),

      totalTasks:
        companyTaskSummary
          .totalTasks,

      activeSubAccounts:
        accounts.length,

      unassignedTasks:
        unassignedTasks.length
    },

    accounts:
      safeAccounts,

    masterAccount:
      safeMasterAccounts.length === 1
        ? safeMasterAccounts[0]
        : null,

    masterAccounts:
      safeMasterAccounts,

    comparisonAccounts:
      safeComparisonAccounts,

    weeklyTrend:
      buildWeeklyTrend(
        allTasks,
        now
      )
  };
}

module.exports = {
  buildDashboardAnalytics
};
