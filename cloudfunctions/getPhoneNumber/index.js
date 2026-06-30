const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var result = await cloud.getOpenData({
      list: [event.cloudID],
      type: "phoneNumber"
    });
    var phoneNumber = result.list[0].data.phoneNumber || "";
    await db.collection("users").doc(OPENID).update({
      data: { phone: phoneNumber }
    });
    return { code: 0, data: { phone: maskPhone(phoneNumber) } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};

function maskPhone(phone) {
  if (!phone || phone.length < 11) return "";
  return phone.substring(0, 3) + "****" + phone.substring(7);
}
