const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  try {
    var tripId = event.tripId;
    if (!tripId) return { code: 1001, message: "tripId required" };
    
    await db.collection("trips").doc(tripId).update({
      data: { viewCount: _.inc(1) }
    });
    
    return { code: 0, data: { success: true } };
  } catch (err) {
    // viewCount field might not exist on old documents
    try {
      await db.collection("trips").doc(event.tripId).update({
        data: { viewCount: 1 }
      });
    } catch(e) {}
    return { code: 0, data: { success: true } };
  }
};
