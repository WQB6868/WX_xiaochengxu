const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var data = event;
    if (!data.brand || !data.model || !data.plateNumber) {
      return { code: 1001, message: "请填写完整信息" };
    }
    // Check if this is the first vehicle
    var count = await db.collection("vehicles").where({ _openid: OPENID }).count();
    var result = await db.collection("vehicles").add({
      data: {
        _openid: OPENID,
        brand: data.brand,
        model: data.model,
        color: data.color || "",
        plateNumber: data.plateNumber,
        seats: parseInt(data.seats) || 4,
        photos: [],
        isDefault: count.total === 0,
        status: "active",
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
    return { code: 0, data: { vehicleId: result._id } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
