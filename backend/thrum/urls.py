from django.contrib import admin
from django.urls import path

from thrum.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
]
