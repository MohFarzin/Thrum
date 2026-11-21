"""Authz helpers — approval gate + staff-only admin."""

from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsApproved(BasePermission):
    """Authenticated + (staff or profile.is_approved)."""

    message = "Account pending admin approval."

    def has_permission(self, request, view) -> bool:  # noqa: ANN001
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        if user.is_staff:
            return True
        profile = getattr(user, "profile", None)
        return bool(profile and profile.is_approved)


class IsStaffAdmin(BasePermission):
    """Staff-only. Used for /api/auth/admin/* — never expose to members."""

    message = "Admin access required."

    def has_permission(self, request, view) -> bool:  # noqa: ANN001
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.is_staff
        )
