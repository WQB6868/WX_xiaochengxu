const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  try {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Mark expired trips as completed
    var expiredTrips = await db.collection("trips").where({
      departDate: _.lt(today),
      status: _.in(["recruiting", "full"])
    }).get();
    
    var ids = (expiredTrips.data || []).map(function(t) { return t._id; });
    for (var i = 0; i < ids.length; i++) {
      await db.collection("trips").doc(ids[i]).update({
        data: { status: "completed", updateTime: db.serverDate() }
      });
    }
    
    // Clean old completed trips (>30 days)
    var cutoff = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    var oldTrips = await db.collection("trips").where({
      updateTime: _.lt(cutoff),
      status: "completed"
    }).get();
    
    var oldIds = (oldTrips.data || []).map(function(t) { return t._id; });
    for (var j = 0; j < oldIds.length; j++) {
      await db.collection("trips").doc(oldIds[j]).remove();
    }
    
    return {
      code: 0,
      data: { expired: ids.length, cleaned: oldIds.length }
    };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
