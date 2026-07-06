const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var requestId = event.requestId;
    if (!requestId) return { code: 1001, message: "缺少参数" };
    var req = await db.collection("requests").doc(requestId).get();
    if (!req.data) return { code: 2001, message: "求车信息不存在" };
    if (req.data._openid !== OPENID) return { code: 1004, message: "无权限" };
    await db.collection("requests").doc(requestId).update({
      data: { status: "cancelled", updateTime: db.serverDate() }
    });
    return { code: 0, data: { status: "cancelled" } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
