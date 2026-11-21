from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Profile
from apps.monitors.checkers import udp_datagram
from apps.monitors.models import Circuit, CircuitMembership, Monitor

User = get_user_model()


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
class CircuitTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("owner", password="testpass123")
        Profile.objects.update_or_create(user=self.user, defaults={"is_approved": True})
        self.client.login(username="owner", password="testpass123")

    def test_create_circuit_and_assign_monitors(self):
        m = Monitor.objects.create(
            owner=self.user,
            name="web",
            type=Monitor.Type.HTTP,
            target="https://example.com",
        )
        res = self.client.post(
            "/api/circuits/",
            {"name": "Prod", "description": "edge", "monitor_ids": [str(m.id)]},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(body["name"], "Prod")
        self.assertEqual(body["monitor_count"], 1)
        self.assertTrue(CircuitMembership.objects.filter(circuit_id=body["id"], monitor=m).exists())

    def test_pulse_list_hides_circuit_members(self):
        bare = Monitor.objects.create(
            owner=self.user, name="bare", type=Monitor.Type.HTTP, target="https://a.example"
        )
        grouped = Monitor.objects.create(
            owner=self.user, name="grouped", type=Monitor.Type.HTTP, target="https://b.example"
        )
        circuit = Circuit.objects.create(owner=self.user, name="Fleet")
        CircuitMembership.objects.create(circuit=circuit, monitor=grouped)
        res = self.client.get("/api/monitors/?unassigned=1")
        self.assertEqual(res.status_code, 200)
        ids = {row["id"] for row in res.json()}
        self.assertIn(str(bare.id), ids)
        self.assertNotIn(str(grouped.id), ids)

    def test_max_three_circuits(self):
        m = Monitor.objects.create(
            owner=self.user, name="busy", type=Monitor.Type.HTTP, target="https://c.example"
        )
        cids = []
        for i in range(3):
            c = Circuit.objects.create(owner=self.user, name=f"C{i}")
            CircuitMembership.objects.create(circuit=c, monitor=m)
            cids.append(str(c.id))
        fourth = Circuit.objects.create(owner=self.user, name="C3")
        res = self.client.patch(
            f"/api/monitors/{m.id}/",
            {"circuits": cids + [str(fourth.id)]},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_public_circuit_hides_targets(self):
        circuit = Circuit.objects.create(
            owner=self.user, name="Fleet A", is_public=True, public_slug="circtest1"
        )
        m = Monitor.objects.create(
            owner=self.user,
            name="api",
            type=Monitor.Type.HTTP,
            target="https://secret.internal/health",
            status=Monitor.Status.UP,
        )
        CircuitMembership.objects.create(circuit=circuit, monitor=m)
        self.client.logout()
        res = self.client.get("/api/public/circuit/circtest1/")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["name"], "Fleet A")
        self.assertEqual(body["counts"]["total"], 1)
        self.assertNotIn("target", body["monitors"][0])
        self.assertNotIn("secret", str(body))

    def test_bedrock_udp_payload(self):
        data = udp_datagram("bedrock")
        self.assertEqual(data[0], 0x01)
        self.assertGreater(len(data), 20)
