const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async function(event, context) {
  try {
    var requestId = event.requestId;
    if (!requestId) return { code: 1001, message: "缺少请求ID" };
    var result = await db.collection("requests").doc(requestId).get();
    if (!result.data) return { code: 2001, message: "请求不存在" };
    var r = result.data;
    var user = await db.collection("users").doc(r._openid).get();
    var u = user.data || {};
    return {
      code: 0,
      data: {
        _id: r._id,
        _openid: r._openid,
        fromCity: r.fromCity,
        toCity: r.toCity,
        departDate: r.departDate,
        departTime: r.departTime || "",
        passengers: r.passengers,
        contactPhone: r.contactPhone,
        remarks: r.remarks,
        status: r.status,
        createTime: r.createTime,
        userInfo: {
          nickName: u.nickName || "",
          avatarUrl: u.avatarUrl || "",
          phone: u.phone || ""
        }
      }
    };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};