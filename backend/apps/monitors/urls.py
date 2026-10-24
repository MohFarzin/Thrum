from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MonitorViewSet, public_status

router = DefaultRouter()
router.register("monitors", MonitorViewSet, basename="monitor")

urlpatterns = [
    path("public/status/<str:slug>/", public_status, name="public-status"),
    *router.urls,
]
