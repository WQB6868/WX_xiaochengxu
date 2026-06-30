const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    // 改用 where 查询避免 doc().get() 在文档不存在时抛出异常
    var userResult = await db.collection("users").where({ _id: OPENID }).get();
    var userData = userResult.data && userResult.data[0];
    if (!userData || !userData.idCardVerified) {
      return { code: 1003, message: "请先完成实名认证" };
    }
    var data = event;
    if (!data.from || !data.to || !data.departDate || !data.departTime) {
      return { code: 1001, message: "缺少必要参数" };
    }
    data.seats = parseInt(data.seats) || 1;
    data.price = parseFloat(data.price) || 0;
    if (data.seats < 1 || data.seats > 4) {
      return { code: 1001, message: "座位数需在1-4之间" };
    }
    var vehicleInfo = {};
    if (data.vehicleId) {
      try {
        var vehicle = await db.collection("vehicles").doc(data.vehicleId).get();
        if (vehicle.data) {
          vehicleInfo = {
            brand: vehicle.data.brand || "",
            model: vehicle.data.model || "",
            color: vehicle.data.color || "",
            plateNumber: vehicle.data.plateNumber || ""
          };
        }
      } catch (e) {}
    }
    var trip = {
      _openid: OPENID,
      from: data.from,
      to: data.to,
      waypoints: data.waypoints || [],
      departDate: new Date(data.departDate),
      departTime: data.departTime,
      seats: data.seats,
      price: data.price,
      vehicleId: data.vehicleId || "",
      vehicleInfo: vehicleInfo,
      contactPhone: data.contactPhone || "", remarks: data.remarks || "",
      tags: data.tags || [],
      status: "recruiting",
      passengerCount: 0,
      passengers: [],
      shareCode: "",
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };
    // 同步更新用户的手机号
    if (data.contactPhone) {
      try {
        await db.collection("users").doc(OPENID).update({
          data: { phone: data.contactPhone }
        });
      } catch (e) {}
    }

    var result = await db.collection("trips").add({ data: trip });
    return { code: 0, data: { tripId: result._id, status: "recruiting" } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
