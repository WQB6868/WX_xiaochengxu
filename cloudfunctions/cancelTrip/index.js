const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var tripId = event.tripId;
    var reason = event.reason || "";
    var trip = await db.collection("trips").doc(tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    var t = trip.data;
    if (t._openid !== OPENID) {
      // Passenger cancels their application
      var passengers = t.passengers || [];
      var idx = passengers.findIndex(function(p) { return p._openid === OPENID; });
      if (idx === -1) return { code: 1004, message: "无权限" };
      passengers[idx].status = "cancelled";
      passengers[idx].cancelTime = db.serverDate();
      var confirmedPassengers = passengers.filter(function(p) { return p.status === "confirmed"; });
      await db.collection("trips").doc(tripId).update({
        data: {
          passengers: passengers,
          passengerCount: confirmedPassengers.length,
          status: "recruiting"
        }
      });
      // Restore request status to active so it can be searched again
      try {
        await db.collection("requests").where({
          _openid: OPENID,
          status: _.in(["invited", "confirmed"]),
          invitedTripId: tripId
        }).update({
          data: { status: "active", invitedTripId: "", updateTime: db.serverDate() }
        });
      } catch(e) {}
      try {
        await db.collection("applications").where({
          tripId: tripId,
          passengerOpenId: OPENID
        }).update({
          data: { status: "cancelled_by_passenger", updateTime: db.serverDate() }
        });
      } catch(e) {}
    } else {
      // Driver cancels entire trip
      await db.collection("trips").doc(tripId).update({
        data: { status: "cancelled", updateTime: db.serverDate() }
      });
      try {
        await db.collection("applications").where({
          tripId: tripId
        }).update({
          data: { status: "cancelled_by_driver", updateTime: db.serverDate() }
        });
      } catch(e) {}
    }
    return { code: 0, data: { status: "cancelled" } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
