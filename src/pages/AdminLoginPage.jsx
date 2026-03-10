import React from "react";
import { Navigate } from "react-router-dom";
import AdminLoginCard from "../components/AdminLoginCard";
import { useAdminAccess } from "../lib/useAdminAccess";

function AdminLoginPage() {
  const admin = useAdminAccess();

  if (admin.checkingAccess) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-sm text-white/80">Checking admin access...</p>
      </div>
    );
  }

  if (admin.authorized) {
    return <Navigate to="/admin/orders" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">Admin Login</h1>
        <p className="text-sm text-white/80 mt-1">Sign in to access admin tools.</p>
      </div>

      <AdminLoginCard
        authLoading={admin.authLoading}
        signedInEmail={admin.signedInEmail}
        otpCode={admin.otpCode}
        setOtpCode={admin.setOtpCode}
        otpSent={admin.otpSent}
        otpCooldownSeconds={admin.otpCooldownSeconds}
        status={admin.status}
        error={admin.error}
        onSendOtp={admin.login}
        onVerifyOtp={admin.verifyOtp}
        onSignOut={admin.logout}
      />
    </div>
  );
}

export default AdminLoginPage;