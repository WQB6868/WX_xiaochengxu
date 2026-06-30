const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var tripId = event.tripId;
    var trip = await db.collection("trips").doc(tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    if (trip.data._openid !== OPENID) return { code: 1004, message: "无权限" };
    await db.collection("trips").doc(tripId).remove();
    return { code: 0, data: { deleted: true } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
