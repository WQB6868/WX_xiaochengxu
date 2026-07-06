const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async function(event, context) {
  try {
    var trip = await db.collection("trips").doc(event.tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    var t = trip.data;
    var user = await db.collection("users").doc(t._openid).get();
    var driver = user.data || {};
    var passengerList = (t.passengers || []).filter(function(p) {
      return p.status === "confirmed" || p.status === "pending" || p.status === "invited";
    }).map(function(p) {
      return {
        openid: p._openid,
        nickname: p.nickname,
        avatarUrl: p.avatarUrl,
        phone: p.phone || "",
        passengerCount: p.passengerCount || 1,
        status: p.status,
        applyTime: p.applyTime
      };
    });
    var fromData = typeof t.from === 'string' ? { city: t.from, district: '', address: '' } : t.from;
    var toData = typeof t.to === 'string' ? { city: t.to, district: '', address: '' } : t.to;
    return {
      code: 0,
      data: {
        _openid: t._openid,
        _id: t._id,
        contactPhone: t.contactPhone || "",
        from: fromData,
        to: toData,
        waypoints: t.waypoints || [],
        departDate: t.departDate,
        departTime: t.departTime,
        seats: t.seats,
        price: t.price,
        remainingSeats: t.seats - t.passengerCount,
        vehicleInfo: t.vehicleInfo || {},
        remarks: t.remarks || "",
        tags: t.tags || [],
        status: t.status,
        passengerCount: t.passengerCount,
        driver: {
          nickName: driver.nickName || "",
          avatarUrl: driver.avatarUrl || "",
          phone: driver.phone || t.contactPhone || "",
          ratingAvg: driver.ratingAvg || 0,
          ratingCount: driver.ratingCount || 0,
          idCardVerified: driver.idCardVerified || false,
          tripCountAsDriver: driver.tripCountAsDriver || 0
        },
        passengers: passengerList,
        createTime: t.createTime
      }
    };
  } catch (err) {
    if (err.message && err.message.indexOf("NOT_FOUND") > -1) {
      return { code: 2001, message: "行程不存在" };
    }
    return { code: 4001, message: err.message };
  }
};