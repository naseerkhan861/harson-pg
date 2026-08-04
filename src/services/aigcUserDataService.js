"use strict";

const providerConfigModel = require(
  "../models/aigcMasterProviderConfigCsvModel"
);

const userTokenCacheModel = require(
  "../models/aigcUserTokenCacheCsvModel"
);

const taskSnapshotModel = require(
  "../models/aigcTaskSnapshotCsvModel"
);

const credentialCrypto = require(
  "../utils/yibaiCredentialCrypto"
);

const yibaiUserDataClient = require(
  "./yibaiUserDataClient"
);

function requireText(
  value,
  fieldName
) {
  const normalizedValue =
    String(
      value || ""
    ).trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空`
    );
  }

  return normalizedValue;
}

function isSuccessfulResponse(
  response
) {
  return Boolean(
    response &&
    response.success === true &&
    Number(response.code) === 200
  );
}

function getResponseMessage(
  response,
  fallbackMessage
) {
  return String(
    response?.message ||
    fallbackMessage
  );
}

function removeTokenFromMember(
  memberResult
) {
  if (
    !memberResult ||
    typeof memberResult !== "object"
  ) {
    return {};
  }

  const safeMember = {
    ...memberResult
  };

  delete safeMember.token;

  return safeMember;
}

/**
 * 读取企业主账号的 YiBai 绑定。
 */
function getProviderContext(
  masterAccountId
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const providerConfig =
    providerConfigModel
      .getProviderConfigByMasterAccountId(
        normalizedMasterAccountId
      );

  if (!providerConfig) {
    throw new Error(
      "当前企业主账号尚未绑定 YiBai 外部账号"
    );
  }

  if (
    providerConfig.status &&
    providerConfig.status !==
      "active"
  ) {
    throw new Error(
      "当前企业主账号的 YiBai 外部账号绑定已停用"
    );
  }

  const providerAccount =
    requireText(
      providerConfig.providerAccount,
      "YiBai外部账号"
    );

  return {
    masterAccountId:
      normalizedMasterAccountId,

    providerAccount,

    providerConfig
  };
}

/**
 * 解密已经安全保存的 YiBai 密码。
 *
 * 不新增密码文件，
 * 也不把密码写入用户端 Token CSV。
 */
function decryptProviderPassword(
  context
) {
  const {
    masterAccountId,
    providerAccount,
    providerConfig
  } = context;

  return credentialCrypto
    .decryptProviderPassword({
      masterAccountId,
      providerAccount,

      encryptionVersion:
        providerConfig
          .encryptionVersion,

      encryptedPassword:
        providerConfig
          .encryptedPassword,

      passwordIv:
        providerConfig
          .passwordIv,

      passwordAuthTag:
        providerConfig
          .passwordAuthTag
    });
}

/**
 * 显式建立 YiBai 用户端登录状态。
 *
 * 调用：
 * POST /user/member/login
 *
 * 返回的 Access-Token-User
 * 加密保存到独立用户端缓存，
 * 不覆盖 Workspace 管理端 Token。
 */
async function loginAndCacheUserDataToken(
  masterAccountId
) {
  const context =
    getProviderContext(
      masterAccountId
    );

  const providerPassword =
    decryptProviderPassword(
      context
    );

  const loginResult =
    await yibaiUserDataClient.login(
      context.providerAccount,
      providerPassword
    );

  if (
    !isSuccessfulResponse(
      loginResult
    )
  ) {
    throw new Error(
      getResponseMessage(
        loginResult,
        "YiBai 用户端账号登录失败"
      )
    );
  }

  const userToken =
    String(
      loginResult.result?.token ||
      ""
    ).trim();

  if (!userToken) {
    throw new Error(
      "YiBai 用户端登录成功，但响应中没有 Token"
    );
  }

  userTokenCacheModel
    .upsertTokenCache({
      masterAccountId:
        context.masterAccountId,

      providerAccount:
        context.providerAccount,

      token:
        userToken
    });

  return {
    success: true,

    token:
      userToken,

    source:
      "login",

    masterAccountId:
      context.masterAccountId,

    providerAccount:
      context.providerAccount,

    member:
      removeTokenFromMember(
        loginResult.result
      )
  };
}

function buildUnavailableResult({
  context,
  reason,
  message
}) {
  return {
    success: false,
    reason,

    masterAccountId:
      context.masterAccountId,

    providerAccount:
      context.providerAccount,

    message
  };
}

/**
 * 获取有效的 Access-Token-User。
 *
 * 默认 allowLogin=false：
 * 只验证已有缓存，不自动登录。
 *
 * allowLogin=true：
 * 缓存不存在或失效时，
 * 使用已加密保存的密码建立用户端登录。
 */
async function getValidUserDataToken(
  masterAccountId,
  {
    allowLogin = false
  } = {}
) {
  const context =
    getProviderContext(
      masterAccountId
    );

  const loginWhenAllowed =
    async (
      reason,
      message
    ) => {
      if (allowLogin) {
        return loginAndCacheUserDataToken(
          context.masterAccountId
        );
      }

      return buildUnavailableResult({
        context,
        reason,
        message
      });
    };

  let cachedToken = null;

  try {
    cachedToken =
      userTokenCacheModel
        .getTokenCache(
          context.masterAccountId
        );
  } catch (error) {
    console.warn(
      "YiBai 用户端 Token 缓存读取失败，将删除损坏缓存：",
      error.message
    );

    userTokenCacheModel
      .removeTokenCache(
        context.masterAccountId
      );
  }

  if (!cachedToken?.token) {
    return loginWhenAllowed(
      "user_token_missing",
      "当前企业尚未建立 YiBai 用户数据登录状态"
    );
  }

  if (
    cachedToken.providerAccount !==
    context.providerAccount
  ) {
    userTokenCacheModel
      .removeTokenCache(
        context.masterAccountId
      );

    return loginWhenAllowed(
      "provider_account_changed",
      "YiBai 外部账号已变更，需要重新建立用户数据登录状态"
    );
  }

  const validationResult =
    await yibaiUserDataClient
      .loginByToken(
        cachedToken.token
      );

  if (
    !isSuccessfulResponse(
      validationResult
    )
  ) {
    userTokenCacheModel
      .removeTokenCache(
        context.masterAccountId
      );

    const reason =
      Number(
        validationResult?.code
      ) === 601
        ? "user_token_expired"
        : "user_token_invalid";

    return loginWhenAllowed(
      reason,
      getResponseMessage(
        validationResult,
        "YiBai 用户数据登录状态无效"
      )
    );
  }

  const validatedToken =
    String(
      validationResult
        .result?.token ||
      cachedToken.token
    ).trim();

  if (!validatedToken) {
    userTokenCacheModel
      .removeTokenCache(
        context.masterAccountId
      );

    return loginWhenAllowed(
      "validated_token_missing",
      "YiBai 用户端 Token 验证成功，但响应中没有可用 Token"
    );
  }

  if (
    validatedToken !==
    cachedToken.token
  ) {
    userTokenCacheModel
      .upsertTokenCache({
        masterAccountId:
          context.masterAccountId,

        providerAccount:
          context.providerAccount,

        token:
          validatedToken
      });
  } else {
    userTokenCacheModel
      .touchTokenCache(
        context.masterAccountId
      );
  }

  return {
    success: true,

    token:
      validatedToken,

    source:
      "cache",

    masterAccountId:
      context.masterAccountId,

    providerAccount:
      context.providerAccount,

    member:
      removeTokenFromMember(
        validationResult.result
      )
  };
}


function toNonNegativeNumber(
  value
) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue < 0
  ) {
    return 0;
  }

  return numericValue;
}


/**
 * 将 CL-AIGC 充值订单转换为
 * Harson-Base 前端可安全使用的结构。
 */
function normalizeRechargeRecord(
  record = {}
) {
  return {
    orderId:
      String(
        record.orderId ?? ""
      ).trim(),

    orderSn:
      String(
        record.orderSn ?? ""
      ).trim(),

    productName:
      String(
        record.productName || ""
      ).trim(),

    orderAmount:
      toNonNegativeNumber(
        record.orderAmount
      ),

    tokenAmount:
      toNonNegativeNumber(
        record.productNum
      ),

    datePay:
      String(
        record.datePay || ""
      ).trim(),

    dateBegin:
      String(
        record.dateBegin || ""
      ).trim(),

    dateEnd:
      String(
        record.dateEnd || ""
      ).trim(),

    companyId:
      String(
        record.companyId ?? ""
      ).trim(),

    memberId:
      String(
        record.memberId ?? ""
      ).trim(),

    service:
      String(
        record.service || ""
      ).trim(),

    payWay:
      String(
        record.payWay || ""
      ).trim()
  };
}

/**
 * 同一订单优先使用 orderId 去重，
 * 没有 orderId 时使用 orderSn。
 *
 * 后出现的数据覆盖前面的数据，
 * 后出现的数据覆盖前面的数据。
 */
function deduplicateRechargeRecords(
  records
) {
  const recordMap =
    new Map();

  records.forEach(
    (
      rawRecord,
      index
    ) => {
      const record =
        normalizeRechargeRecord(
          rawRecord
        );

      const key =
        record.orderId ||
        record.orderSn ||
        [
          "fallback",
          record.datePay,
          record.memberId,
          record.tokenAmount,
          record.orderAmount,
          index
        ].join(":");

      recordMap.set(
        key,
        record
      );
    }
  );

  return Array.from(
    recordMap.values()
  );
}

/**
 * 读取当前企业可见的
 * 真实充值订单记录。
 *
 * 默认 allowLogin=false：
 * 页面普通加载不会自动切换用户数据登录态。
 *
 * 只有用户明确触发 Token 明细时，
 * Controller 才可以传 allowLogin=true，
 * 并在读取完成后恢复 Workspace 登录态。
 */
async function getRechargeRecords(
  masterAccountId,
  {
    datePay = "",
    pageSize = 100,
    allowLogin = false
  } = {}
) {
  const tokenContext =
    await getValidUserDataToken(
      masterAccountId,
      {
        allowLogin
      }
    );

  if (!tokenContext.success) {
    throw new Error(
      tokenContext.message ||
      "无法建立 CL-AIGC 用户数据登录状态"
    );
  }

  const rechargeResponse =
    await yibaiUserDataClient
      .selectAllRecharge(
        tokenContext.token,
        {
          datePay,
          pageSize
        }
      );

  if (
    !isSuccessfulResponse(
      rechargeResponse
    )
  ) {
    if (
      Number(
        rechargeResponse?.code
      ) === 601
    ) {
      userTokenCacheModel
        .removeTokenCache(
          tokenContext
            .masterAccountId
        );
    }

    throw new Error(
      getResponseMessage(
        rechargeResponse,
        "读取 CL-AIGC Token 充值记录失败"
      )
    );
  }




  const rawRecords =
  Array.isArray(
    rechargeResponse.result
  )
    ? rechargeResponse.result
    : Array.isArray(
        rechargeResponse.result?.data
      )
      ? rechargeResponse.result.data
      : [];

  const records =
    deduplicateRechargeRecords(
      rawRecords
    )
      .sort(
        (
          left,
          right
        ) =>
          right.datePay
            .localeCompare(
              left.datePay
            )
      );

  const totalPaidAmount =
    records.reduce(
      (
        total,
        record
      ) =>
        total +
        record.orderAmount,
      0
    );

  const totalTokenAmount =
    records.reduce(
      (
        total,
        record
      ) =>
        total +
        record.tokenAmount,
      0
    );

  return {
    masterAccountId:
      tokenContext
        .masterAccountId,

    providerAccount:
      tokenContext
        .providerAccount,

    tokenSource:
      tokenContext.source,

    summary: {
      totalOrders:
        records.length,

      totalPaidAmount,

      totalTokenAmount
    },

    records
  };
}


function taskStatusLabel(
  status
) {
  const normalizedStatus =
    String(
      status || ""
    ).trim();

  if (normalizedStatus === "O") {
    return "成功";
  }

  if (normalizedStatus === "R") {
    return "失败";
  }

  return "处理中";
}

function normalizeTask(
  task
) {
  const point =
    toNonNegativeNumber(
      task?.point
    );

  const refundedPoint =
    toNonNegativeNumber(
      task?.rpoint
    );

  return {
    id:
      String(
        task?.id || ""
      ).trim(),

    status:
      String(
        task?.status || ""
      ).trim(),

    statusLabel:
      taskStatusLabel(
        task?.status
      ),

    object:
      String(
        task?.object || ""
      ).trim(),

    objectName:
      String(
        task?.objectName ||
        "AIGC 创作任务"
      ).trim(),

    imageUrl:
      String(
        task?.imageUrl || ""
      ).trim(),

    imageWidth:
      toNonNegativeNumber(
        task?.imageWidth
      ),

    imageHeight:
      toNonNegativeNumber(
        task?.imageHeight
      ),

    point,

    rpoint:
      refundedPoint,

    netPoint:
      point - refundedPoint,

    memberId:
      String(
        task?.memberId || ""
      ).trim(),

    memberName:
      String(
        task?.memberName || ""
      ).trim(),

    companyId:
      String(
        task?.companyId || ""
      ).trim(),

    companyName:
      String(
        task?.companyName || ""
      ).trim(),

    dateCreate:
      String(
        task?.dateCreate || ""
      ).trim(),

    dateEnd:
      String(
        task?.dateEnd || ""
      ).trim(),

    createdAt:
      String(
        task?.createdAt || ""
      ).trim()
  };
}

function deduplicateTasks(
  tasks
) {
  const taskMap =
    new Map();

  tasks.forEach(task => {
    const normalizedTask =
      normalizeTask(task);

    if (!normalizedTask.id) {
      return;
    }

    /*
     * 相同任务 ID 后出现的数据
     * 覆盖先出现的数据。
     */
    taskMap.set(
      normalizedTask.id,
      normalizedTask
    );
  });

  return Array.from(
    taskMap.values()
  );
}

function taskSortTime(
  task
) {
  return (
    task.dateEnd ||
    task.dateCreate ||
    task.createdAt ||
    ""
  );
}

/**
 * 查询企业真实创作任务。
 *
 * 用户端 Token 只在后端使用，
 * 不会进入返回结果。
 *
 * memberId 有值时，只返回该使用人的任务；
 * memberId 为空时，返回当前企业全部任务。
 */
async function getCompanyTaskSnapshot(
  masterAccountId,
  {
    memberId = "",
    dateEnd = "",
    pageSize = 100,
    allowLogin = false
  } = {}
) {
  const tokenContext =
    await getValidUserDataToken(
      masterAccountId,
      {
        allowLogin
      }
    );

  if (!tokenContext.success) {
    throw new Error(
      tokenContext.message ||
      "无法建立 CL-AIGC 用户数据登录状态"
    );
  }

  const taskResponse =
    await yibaiUserDataClient
      .selectAllTaskByCompany(
        tokenContext.token,
        {
          dateEnd,
          pageSize
        }
      );

  if (
    !isSuccessfulResponse(
      taskResponse
    )
  ) {
    if (
      Number(
        taskResponse?.code
      ) === 601
    ) {
      userTokenCacheModel
        .removeTokenCache(
          tokenContext
            .masterAccountId
        );
    }

    throw new Error(
      getResponseMessage(
        taskResponse,
        "读取 YiBai 创作任务失败"
      )
    );
  }

  const rawTasks =
    Array.isArray(
      taskResponse.result
    )
      ? taskResponse.result
      : [];

  const normalizedMemberId =
    String(
      memberId || ""
    ).trim();

  const tasks =
    deduplicateTasks(
      rawTasks
    )
      .filter(task =>
        !normalizedMemberId ||
        task.memberId ===
          normalizedMemberId
      )
      .sort(
        (left, right) =>
          taskSortTime(right)
            .localeCompare(
              taskSortTime(left)
            )
      );

  const deductedTokens =
    tasks.reduce(
      (
        total,
        task
      ) =>
        total + task.point,
      0
    );

  const refundedTokens =
    tasks.reduce(
      (
        total,
        task
      ) =>
        total + task.rpoint,
      0
    );

  return {
    memberId:
      normalizedMemberId ||
      null,

    summary: {
      totalTasks:
        tasks.length,

      successfulTasks:
        tasks.filter(
          task =>
            task.status === "O"
        ).length,

      failedTasks:
        tasks.filter(
          task =>
            task.status === "R"
        ).length,

      processingTasks:
        tasks.filter(
          task =>
            task.status !== "O" &&
            task.status !== "R"
        ).length,

      deductedTokens,

      refundedTokens,

      netUsedTokens:
        deductedTokens -
        refundedTokens
    },

    tasks
  };
}



function normalizeIdentity(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function addIdentityCandidate(
  candidates,
  value
) {
  const normalizedValue =
    normalizeIdentity(value);

  if (!normalizedValue) {
    return;
  }

  candidates.add(
    normalizedValue
  );

  /*
   * AIGC 登录名可能是邮箱，
   * 而 memberName 可能只返回
   * 邮箱 @ 前面的用户名。
   */
  const atIndex =
    normalizedValue.indexOf(
      "@"
    );

  if (atIndex > 0) {
    candidates.add(
      normalizedValue.slice(
        0,
        atIndex
      )
    );
  }
}

function buildMemberIdentityCandidates(
  identityContext = {}
) {
  const candidates =
    new Set();

  [
    identityContext.platformLogin,
    identityContext.subAccountName,
    identityContext.clBaseEmail,
    identityContext.userEmail,
    identityContext.userName
  ].forEach(value => {
    addIdentityCandidate(
      candidates,
      value
    );
  });

  return candidates;
}

function normalizeChildMember(
  child
) {
  return {
    memberId:
      String(
        child?.memberId || ""
      ).trim(),

    companyId:
      String(
        child?.companyId || ""
      ).trim(),

    memberName:
      String(
        child?.memberName || ""
      ).trim(),

    ownerName:
      String(
        child?.ownerName || ""
      ).trim(),

    isStatus:
      Number(
        child?.isStatus
      )
  };
}

/**
 * 根据 Harson-Base 已保存的
 * AIGC 登录信息匹配 YiBai 子账号。
 *
 * 匹配不到或匹配到多个时直接报错，
 * 不能回退为返回整个企业任务。
 */
function resolveChildMember(
  children,
  identityContext
) {
  const candidates =
    buildMemberIdentityCandidates(
      identityContext
    );

  if (
    candidates.size === 0
  ) {
    throw new Error(
      "缺少用于匹配 YiBai 子账号的登录信息"
    );
  }

  const matches =
    children
      .map(
        normalizeChildMember
      )
      .filter(child => {
        if (
          !child.memberId ||
          child.isStatus === 0
        ) {
          return false;
        }

        const childIdentities =
          new Set();

        addIdentityCandidate(
          childIdentities,
          child.memberName
        );

        addIdentityCandidate(
          childIdentities,
          child.ownerName
        );

        return Array.from(
          childIdentities
        ).some(identity =>
          candidates.has(
            identity
          )
        );
      });

  if (matches.length === 0) {
    throw new Error(
      "未找到与当前 Harson-Base 账号匹配的 YiBai 子账号"
    );
  }

  if (matches.length > 1) {
    throw new Error(
      "当前账号匹配到多个 YiBai 子账号，请检查账号名称和登录名"
    );
  }

  return matches[0];
}

/**
 * 获取当前 Harson-Base 用户自己的
 * YiBai 创作任务。
 *
 * 不允许返回其他企业成员的任务。
 */
async function getMemberTaskSnapshot(
  masterAccountId,
  identityContext,
  {
    dateEnd = "",
    pageSize = 100,
    allowLogin = false
  } = {}
) {
  const tokenContext =
    await getValidUserDataToken(
      masterAccountId,
      {
        allowLogin
      }
    );

  if (!tokenContext.success) {
    throw new Error(
      tokenContext.message ||
      "无法建立 CL-AIGC 用户数据登录状态"
    );
  }

  const memberResponse =
    await yibaiUserDataClient
      .memberWithChildren(
        tokenContext.token
      );

  if (
    !isSuccessfulResponse(
      memberResponse
    )
  ) {
    if (
      Number(
        memberResponse?.code
      ) === 601
    ) {
      userTokenCacheModel
        .removeTokenCache(
          tokenContext
            .masterAccountId
        );
    }

    throw new Error(
      getResponseMessage(
        memberResponse,
        "读取 YiBai 子账号列表失败"
      )
    );
  }

  const children =
    Array.isArray(
      memberResponse
        .result?.children
    )
      ? memberResponse
          .result.children
      : [];

  const member =
    resolveChildMember(
      children,
      identityContext
    );

  const taskSnapshot =
    await getCompanyTaskSnapshot(
      masterAccountId,
      {
        memberId:
          member.memberId,

        dateEnd,
        pageSize,
        allowLogin: false
      }
    );

  return {
    member,
    ...taskSnapshot
  };
}



/**
 * 从 YiBai 用户端读取企业任务，
 * 并保存到本地任务快照。
 *
 * 只有管理员明确触发同步时
 * 才应调用此方法。
 */
async function syncCompanyTaskSnapshot(
  masterAccountId,
  {
    dateEnd = "",
    pageSize = 100
  } = {}
) {
  const normalizedMasterAccountId =
    requireText(
      masterAccountId,
      "AIGC企业主账号ID"
    );

  const snapshot =
    await getCompanyTaskSnapshot(
      normalizedMasterAccountId,
      {
        dateEnd,
        pageSize,

        /*
         * 同步操作由管理员明确触发，
         * 因此允许建立用户端登录。
         */
        allowLogin: true
      }
    );

  const storageResult =
    taskSnapshotModel.upsertTasks({
      masterAccountId:
        normalizedMasterAccountId,

      tasks:
        snapshot.tasks
    });

  return {
    masterAccountId:
      normalizedMasterAccountId,

    summary:
      snapshot.summary,

    storage: {
      insertedCount:
        storageResult.insertedCount,

      updatedCount:
        storageResult.updatedCount,

      totalProcessed:
        storageResult.totalProcessed
    },

    syncedTaskCount:
      snapshot.tasks.length
  };
}


function clearUserDataToken(
  masterAccountId
) {
  return userTokenCacheModel
    .removeTokenCache(
      requireText(
        masterAccountId,
        "AIGC企业主账号ID"
      )
    );
}

module.exports = {
  loginAndCacheUserDataToken,
  getValidUserDataToken,
  getCompanyTaskSnapshot,
  getMemberTaskSnapshot,
  syncCompanyTaskSnapshot,
  clearUserDataToken,
  getRechargeRecords
};
