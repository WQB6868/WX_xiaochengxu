const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var trip = await db.collection("trips").doc(event.tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    if (trip.data._openid !== OPENID) return { code: 1004, message: "无权限" };
    var validStatus = ["departed", "completed"];
    if (validStatus.indexOf(event.status) === -1) {
      return { code: 1001, message: "无效的状态值" };
    }
    await db.collection("trips").doc(event.tripId).update({
      data: { status: event.status, updateTime: db.serverDate() }
    });
    return { code: 0, data: { status: event.status } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
