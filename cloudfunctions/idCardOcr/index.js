const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var realName = event.realName || "";
    var idCard = event.idCard || "";
    if (!realName || !idCard) {
      return { code: 1001, message: "请填写姓名和身份证号" };
    }
    if (!/^[\u4e00-\u9fa5]{2,10}$/.test(realName)) {
      return { code: 1001, message: "请输入真实姓名" };
    }
    if (!/^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard)) {
      return { code: 1001, message: "身份证号格式不正确" };
    }
    var crypto = require("crypto");
    var hash = crypto.createHash("sha256").update(idCard).digest("hex");
    await db.collection("users").doc(OPENID).update({
      data: {
        realName: realName,
        idCard: hash,
        idCardVerified: true,
        idCardVerifyTime: db.serverDate()
      }
    });
    return { code: 0, data: { verified: true } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
