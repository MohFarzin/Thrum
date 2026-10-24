from django.contrib import admin
from django.urls import include, path, re_path

from thrum.spa import SpaIndexView
from thrum.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.monitors.urls")),
    # Client-side routes when Django serves the built SPA (Pterodactyl all-in-one).
    re_path(
        r"^(?!api/|admin/|static/|assets/|favicon\.svg|icons\.svg).*$",
        SpaIndexView.as_view(),
        name="spa",
    ),
]
