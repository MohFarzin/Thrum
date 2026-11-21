from django.contrib import admin
from django.urls import include, path, re_path

from thrum.spa import SpaIndexView
from thrum.views import health

urlpatterns = [
    # Django admin moved so the SPA can own /admin for staff user management.
    path("django-admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.ingest.urls")),
    path("api/", include("apps.monitors.urls")),
    path("api/", include("apps.alerts.urls")),
    # Client-side routes when Django serves the built SPA (Pterodactyl all-in-one).
    # Skip real static files (logo/favicon/assets) so WhiteNoise can serve them.
    re_path(
        r"^(?!api/|django-admin/|static/|assets/)(?!.*\.[A-Za-z0-9]{1,8}$).*$",
        SpaIndexView.as_view(),
        name="spa",
    ),
]
