const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var data = event;
    if (!data.fromCity || !data.toCity) {
      return { code: 1001, message: "缺少必要参数" };
    }
    var requestData = {
      _openid: OPENID,
      fromCity: data.fromCity,
      toCity: data.toCity,
      departDate: data.departDate ? new Date(data.departDate) : null,
      departTime: data.departTime || "",
      passengers: parseInt(data.passengers) || 1,
      contactPhone: data.contactPhone || "",
      remarks: data.remarks || "",
      status: "active",
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };
    // 更新用户的手机号
    if (data.contactPhone) {
      try {
        await db.collection("users").doc(OPENID).update({
          data: { phone: data.contactPhone }
        });
      } catch (e) {}
    }
    var result = await db.collection("requests").add({ data: requestData });
    return { code: 0, data: { requestId: result._id } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};