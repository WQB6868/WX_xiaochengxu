const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var existing = await db.collection("ratings").where({
      fromUserId: OPENID,
      tripId: event.tripId
    }).get();
    if (existing.data && existing.data.length > 0) {
      return { code: 3001, message: "您已评价过该行程" };
    }
    var rating = {
      tripId: event.tripId,
      fromUserId: OPENID,
      toUserId: event.toUserId,
      role: event.role || "passenger",
      score: parseInt(event.score) || 5,
      content: event.content || "",
      tags: event.tags || [],
      createTime: db.serverDate()
    };
    var result = await db.collection("ratings").add({ data: rating });
    var ratings = await db.collection("ratings").where({ toUserId: event.toUserId }).get();
    var scoreList = (ratings.data || []).map(function(r) { return r.score; });
    var avg = scoreList.length > 0 ? (scoreList.reduce(function(a, b) { return a + b; }, 0) / scoreList.length) : 0;
    await db.collection("users").doc(event.toUserId).update({
      data: {
        ratingAvg: Math.round(avg * 10) / 10,
        ratingCount: scoreList.length
      }
    });
    return { code: 0, data: { ratingId: result._id } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
