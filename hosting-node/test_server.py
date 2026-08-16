import hashlib
import json
import os
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class HostServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ["MEDIA_NODE_DATA"] = cls.tmp.name
        os.environ["MEDIA_NODE_WRITE_TOKEN"] = "test-token"
        os.environ["HOST_ID"] = "synology-nas-001"
        os.environ["HOST_MIN_REPLICAS"] = "3"
        os.environ["HOST_SYNC_INTERVAL_SECONDS"] = "0"
        os.environ.pop("SOURCE_REGISTRY_URL", None)
        os.environ["MEDIA_NODE_CORS_ORIGINS"] = "*"
        import server

        server.ensure_genesis()
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.tmp.cleanup()

    def _json(self, method, path, payload=None, token="test-token"):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = Request(f"{self.base}{path}", data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=5) as response:
                body = json.loads(response.read().decode("utf-8") or "{}")
                return response.status, body
        except HTTPError as error:
            body = json.loads(error.read().decode("utf-8") or "{}")
            return error.code, body

    def test_first_host_health_and_full_replica(self):
        status, body = self._json("GET", "/health", token="")
        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])
        self.assertEqual(body["role"], "full-replica")
        self.assertEqual(body["hostId"], "synology-nas-001")
        self.assertEqual(body["minReplicas"], 3)
        self.assertEqual(body["mode"], "full")

    def test_stores_public_listing_and_rejects_secret_fields(self):
        status, body = self._json(
            "PUT",
            "/v1/objects/listing/listing-1",
            {
                "object": {
                    "id": "listing-1",
                    "title": "Oak desk",
                    "email": "seller@example.com",
                    "password": "secret",
                }
            },
        )
        self.assertEqual(status, 201, body)
        status, body = self._json("GET", "/v1/objects/listing/listing-1", token="")
        self.assertEqual(status, 200)
        self.assertEqual(body["object"]["title"], "Oak desk")
        self.assertNotIn("email", body["object"])
        self.assertNotIn("password", body["object"])

    def test_refuses_delete_while_below_replica_floor(self):
        self._json(
            "PUT",
            "/v1/objects/listing/keep-me",
            {"object": {"id": "keep-me", "title": "Keep"}},
        )
        status, body = self._json("DELETE", "/v1/objects/listing/keep-me")
        self.assertEqual(status, 409)
        self.assertEqual(body["error"], "below_replica_floor")

    def test_refuses_sharded_decree_from_single_host(self):
        status, body = self._json(
            "PUT",
            "/v1/decree",
            {
                "decree": {
                    "v": 1,
                    "kind": "open-marketplace-host-decree",
                    "issuedBy": "main",
                    "minReplicas": 3,
                    "mode": "sharded",
                    "shardCount": 16,
                    "hosts": [{"hostId": "synology-nas-001", "shards": ["*"]}],
                }
            },
        )
        self.assertEqual(status, 409)
        self.assertEqual(body["error"], "below_replica_floor")

    def test_media_put_still_hash_checked(self):
        payload = b"photo-bytes"
        digest = hashlib.sha256(payload).hexdigest()
        request = Request(
            f"{self.base}/media/sha256/{digest}",
            data=payload,
            headers={
                "Authorization": "Bearer test-token",
                "Content-Type": "application/octet-stream",
            },
            method="PUT",
        )
        with urlopen(request, timeout=5) as response:
            self.assertEqual(response.status, 201)
        stored = Path(self.tmp.name) / "media" / digest
        self.assertTrue(stored.is_file())


if __name__ == "__main__":
    unittest.main()
