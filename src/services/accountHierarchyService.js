"use strict";

const userCsvModel = require(
  "../models/userCsvModel"
);

const aigcAccountModel = require(
  "../models/aigcAccountCsvModel"
);

const {
  USER_ROLES
} = require("../constants/userRoles");

function requireText(value, fieldName) {
  const normalizedValue =
    String(value || "").trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName}不能为空。`
    );
  }

  return normalizedValue;
}

function validatePassword(
  password,
  fieldName
) {
  if (
    typeof password !== "string" ||
    password.length < 8
  ) {
    throw new Error(
      `${fieldName}至少需要 8 个字符。`
    );
  }

  return password;
}

function validateNonNegativeNumber(
  value,
  fieldName,
  fallback = 0
) {
  const normalizedValue =
    value === undefined ||
    value === null ||
    value === ""
      ? fallback
      : Number(value);

  if (
    !Number.isFinite(normalizedValue) ||
    normalizedValue < 0
  ) {
    throw new Error(
      `${fieldName}必须是非负有效数字。`
    );
  }

  return normalizedValue;
}

function reportRollbackErrors(
  rollbackErrors
) {
  if (rollbackErrors.length === 0) {
    return;
  }

  console.error(
    "账号创建回滚过程中出现异常：",
    rollbackErrors.join("；")
  );
}

/**
 * 创建企业主账号。
 *
 * 流程：
 * 1. 创建 Harson-Base 登录账号；
 * 2. 创建 AIGC 企业主账号；
 * 3. 将企业主账号 ID 写回登录账号；
 * 4. 任一步失败时执行回滚。
 */
async function createEnterpriseMaster({
  name,
  email,
  password,

  enterpriseName,
  platformName,
  platformLogin,
  platformPassword,

  totalCredits = 0
}) {
  let createdUser = null;
  let createdMaster = null;

  try {
    const normalizedName =
      requireText(
        name,
        "企业管理员姓名"
      );

    const normalizedEmail =
      requireText(
        email,
        "Harson-Base 登录邮箱"
      );

    const normalizedEnterpriseName =
      requireText(
        enterpriseName,
        "企业名称"
      );

    const normalizedPlatformName =
      requireText(
        platformName,
        "AIGC 平台账号名称"
      );

    const normalizedPlatformLogin =
      requireText(
        platformLogin,
        "AIGC 登录邮箱"
      );

    validatePassword(
      password,
      "Harson-Base 登录密码"
    );

    validatePassword(
      platformPassword,
      "AIGC 登录密码"
    );

    const normalizedTotalCredits =
      validateNonNegativeNumber(
        totalCredits,
        "企业主账号总点数"
      );

    createdUser =
      await userCsvModel.createUser({
        name: normalizedName,
        email: normalizedEmail,
        password,
        role:
          USER_ROLES.MASTER_ADMIN
      });

    createdMaster =
      await aigcAccountModel
        .createMaster({
          ownerUserId:
            createdUser.id,

          enterpriseName:
            normalizedEnterpriseName,

          platformName:
            normalizedPlatformName,

          platformLogin:
            normalizedPlatformLogin,

          platformPassword,

          totalCredits:
            normalizedTotalCredits
        });

    const updatedUser =
      userCsvModel
        .updateUserHierarchy({
          userId:
            createdUser.id,

          role:
            USER_ROLES.MASTER_ADMIN,

          masterAccountId:
            createdMaster.id,

          subAccountId: ""
        });

    return {
      user: updatedUser,
      masterAccount:
        createdMaster
    };
  } catch (error) {
    const rollbackErrors = [];

    if (createdMaster?.id) {
      try {
        aigcAccountModel
          .deleteMasterForRollback(
            createdMaster.id
          );
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError.message
        );
      }
    }

    if (createdUser?.id) {
      try {
        userCsvModel
          .deleteUserForRollback(
            createdUser.id
          );
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError.message
        );
      }
    }

    reportRollbackErrors(
      rollbackErrors
    );

    throw error;
  }
}

/**
 * 创建企业子账号。
 *
 * 流程：
 * 1. 创建真实可登录的 Harson-Base 子账号；
 * 2. 创建对应的 AIGC 子账号；
 * 3. 将子账号 ID 写回登录账号；
 * 4. 任一步失败时执行回滚。
 */
async function createEnterpriseMember({
  masterAccountId,

  name,
  email,
  password,

  subAccountName,
  platformLogin,
  platformPassword,

  tokenLimit = 0,
  warningThreshold = 10
}) {
  let createdUser = null;
  let createdSubAccount = null;

  try {
    const normalizedMasterAccountId =
      requireText(
        masterAccountId,
        "企业主账号 ID"
      );

    const normalizedName =
      requireText(
        name,
        "子账号用户姓名"
      );

    const normalizedEmail =
      requireText(
        email,
        "Harson-Base 登录邮箱"
      );

    const normalizedSubAccountName =
      requireText(
        subAccountName,
        "子账号名称"
      );

    const normalizedPlatformLogin =
      requireText(
        platformLogin,
        "AIGC 子账号登录邮箱"
      );

    validatePassword(
      password,
      "Harson-Base 登录密码"
    );

    validatePassword(
      platformPassword,
      "AIGC 子账号登录密码"
    );

    const normalizedTokenLimit =
      validateNonNegativeNumber(
        tokenLimit,
        "token 配额"
      );

    const normalizedWarningThreshold =
      Number(warningThreshold);

    if (
      !Number.isFinite(
        normalizedWarningThreshold
      ) ||
      normalizedWarningThreshold < 1 ||
      normalizedWarningThreshold > 100
    ) {
      throw new Error(
        "剩余 token 预警阈值必须在 1 到 100 之间。"
      );
    }

    createdUser =
      await userCsvModel.createUser({
        name:
          normalizedName,

        email:
          normalizedEmail,

        password,

        role:
          USER_ROLES.MEMBER,

        masterAccountId:
          normalizedMasterAccountId,

        subAccountId: ""
      });

    createdSubAccount =
      await aigcAccountModel
        .createSubAccount({
          clBaseUserId:
            createdUser.id,

          masterAccountId:
            normalizedMasterAccountId,

          subAccountName:
            normalizedSubAccountName,

          platformLogin:
            normalizedPlatformLogin,

          platformPassword,

          tokenLimit:
            normalizedTokenLimit,

          warningThreshold:
            normalizedWarningThreshold
        });

    const updatedUser =
      userCsvModel
        .updateUserHierarchy({
          userId:
            createdUser.id,

          role:
            USER_ROLES.MEMBER,

          masterAccountId:
            normalizedMasterAccountId,

          subAccountId:
            createdSubAccount.id
        });

    return {
      user: updatedUser,
      subAccount:
        createdSubAccount
    };
  } catch (error) {
    const rollbackErrors = [];

    if (createdSubAccount?.id) {
      try {
        aigcAccountModel
          .deleteSubAccountForRollback(
            createdSubAccount.id
          );
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError.message
        );
      }
    }

    if (createdUser?.id) {
      try {
        userCsvModel
          .deleteUserForRollback(
            createdUser.id
          );
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError.message
        );
      }
    }

    reportRollbackErrors(
      rollbackErrors
    );

    throw error;
  }
}

module.exports = {
  createEnterpriseMaster,
  createEnterpriseMember
};