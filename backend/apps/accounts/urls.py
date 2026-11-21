from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.csrf, name="auth-csrf"),
    path("register/", views.register, name="auth-register"),
    path("login/", views.login_view, name="auth-login"),
    path("logout/", views.logout_view, name="auth-logout"),
    path("me/", views.me, name="auth-me"),
    path("audit/", views.audit_log, name="auth-audit"),
    # Staff console — IsStaffAdmin enforced in views
    path("admin/users/", views.admin_users, name="auth-admin-users"),
    path("admin/users/<int:user_id>/approve/", views.admin_approve_user, name="auth-admin-approve"),
    path(
        "admin/users/<int:user_id>/set-password/",
        views.admin_set_password,
        name="auth-admin-set-password",
    ),
    path("admin/users/<int:user_id>/", views.admin_update_user, name="auth-admin-update"),
    path(
        "admin/users/<int:user_id>/delete/",
        views.admin_delete_user,
        name="auth-admin-delete",
    ),
]
