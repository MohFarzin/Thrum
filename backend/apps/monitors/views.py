from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Monitor
from .serializers import MonitorSerializer


class MonitorViewSet(viewsets.ModelViewSet):
    serializer_class = MonitorSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"
    lookup_value_regex = r"[0-9a-f-]{36}"

    def get_queryset(self):
        return Monitor.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
