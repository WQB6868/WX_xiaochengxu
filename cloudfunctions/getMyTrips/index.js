const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var page = parseInt(event.page) || 1;
    var pageSize = Math.min(parseInt(event.pageSize) || 20, 50);
    var role = event.role || "all";
    var statusFilter = event.status || "";

    var condition = {};
    if (role === "driver") {
      condition._openid = OPENID;
    } else if (role === "passenger") {
      condition["passengers._openid"] = OPENID;
    } else {
      condition = _.or([{ _openid: OPENID }, { "passengers._openid": OPENID }]);
    }
    if (statusFilter) condition.status = statusFilter;

    var totalResult = await db.collection("trips").where(condition).count();
    var result = await db.collection("trips").where(condition)
      .orderBy("departDate", "desc").orderBy("createTime", "desc")
      .skip((page - 1) * pageSize).limit(pageSize).get();

    var list = (result.data || []).map(function(t) {
      var myRole = t._openid === OPENID ? "driver" : "passenger";
      var myStatus = "confirmed";
      if (myRole === "passenger") {
        // Find most recent active passenger entry (skip cancelled)
        var myEntries = (t.passengers || []).filter(function(p) { return p._openid === OPENID; });
        var activeEntry = null;
        for (var i = myEntries.length - 1; i >= 0; i--) {
          if (myEntries[i].status !== "cancelled") {
            activeEntry = myEntries[i];
            break;
          }
        }
        var me = activeEntry || (myEntries.length > 0 ? myEntries[myEntries.length - 1] : null);
        myStatus = me ? me.status : "unknown";
      }
      return {
        _id: t._id,
        from: { city: t.from.city, district: t.from.district, address: t.from.address },
        to: { city: t.to.city, district: t.to.district, address: t.to.address },
        departDate: t.departDate,
        departTime: t.departTime,
        seats: t.seats, remainingSeats: t.seats - t.passengerCount,
        price: t.price,
        status: t.status,
        myRole: myRole,
        myStatus: myStatus,
        passengerCount: t.passengerCount,
        vehicleInfo: t.vehicleInfo || {},
        createTime: t.createTime
      };
    });

    return {
      code: 0,
      data: { total: totalResult.total, page: page, pageSize: pageSize, hasMore: page * pageSize < totalResult.total, list: list }
    };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};

