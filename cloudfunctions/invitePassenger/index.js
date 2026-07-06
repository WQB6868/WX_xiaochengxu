const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var tripId = event.tripId;
    var passengerOpenId = event.passengerOpenId;
    var phone = event.phone || "";
    var passengerCount = parseInt(event.passengerCount) || 1;
    var nickname = event.nickname || "乘客";
    var avatarUrl = event.avatarUrl || "";
    var requestId = event.requestId || "";

    if (!tripId || !passengerOpenId) {
      return { code: 1001, message: "缺少必要参数" };
    }

    // Get the trip
    var trip = await db.collection("trips").doc(tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    var t = trip.data;

    // Only owner can invite
    if (t._openid !== OPENID) return { code: 1004, message: "无权限" };

    if (t.status !== "recruiting") return { code: 2003, message: "该行程已停止招募" };

    // Check if passenger already exists
    var existing = (t.passengers || []).find(function(p) {
      return p._openid === passengerOpenId && p.status !== "cancelled";
    });
    if (existing) return { code: 3001, message: "该乘客已在行程中" };

    // Check remaining seats
    var confirmedCount = (t.passengers || []).filter(function(p) { return p.status === "confirmed"; }).length;
    var pendingCount = (t.passengers || []).filter(function(p) { return p.status === "pending"; }).length;
    var takenSeats = confirmedCount + pendingCount;
    if (takenSeats + passengerCount > t.seats) return { code: 2002, message: "座位不足" };

    // Get passenger user info
    var passengerUser = await db.collection("users").doc(passengerOpenId).get();
    var pu = passengerUser.data || {};

    // Add passenger to trip
        // Check for existing cancelled entry and update it, or add new
    var passengers = t.passengers || [];
    var existingCancel = passengers.findIndex(function(p) {
      return p._openid === passengerOpenId && p.status === "cancelled";
    });
    
    if (existingCancel >= 0) {
      // Update the existing cancelled entry
      passengers[existingCancel].nickname = nickname || pu.nickName || "??";
      passengers[existingCancel].avatarUrl = avatarUrl || pu.avatarUrl || "";
      passengers[existingCancel].phone = phone || pu.phone || "";
      passengers[existingCancel].passengerCount = passengerCount;
      passengers[existingCancel].status = "invited";
      passengers[existingCancel].inviteTime = db.serverDate();
      
      await db.collection("trips").doc(tripId).update({
        data: { passengers: passengers }
      });
    } else {
      // Add new passenger entry
      var entry = {
        _openid: passengerOpenId,
        nickname: nickname || pu.nickName || "??",
        avatarUrl: avatarUrl || pu.avatarUrl || "",
        phone: phone || pu.phone || "",
        passengerCount: passengerCount,
        status: "invited",
        inviteTime: db.serverDate()
      };
      
      await db.collection("trips").doc(tripId).update({
        data: {
          passengers: _.push(entry)
        }
      });
    }

    // Update the request status
    if (requestId) {
      try {
        await db.collection("requests").doc(requestId).update({
          data: { status: "invited", invitedTripId: tripId, updateTime: db.serverDate() }
        });
      } catch(e) {}
    }

    return { code: 0, data: { status: "invited" } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};