import unittest

import policy


class ReplicaPolicyTests(unittest.TestCase):
    def test_genesis_is_full_copy_on_first_host(self):
        decree = policy.genesis_decree("synology-nas-001", "https://nas.example")
        ok, reason = policy.validate_decree(decree)
        self.assertTrue(ok, reason)
        self.assertEqual(decree["minReplicas"], 3)
        self.assertEqual(decree["mode"], "full")
        self.assertTrue(
            policy.host_should_store("synology-nas-001", "listing:abc", decree)
        )

    def test_sharded_decree_rejected_below_floor(self):
        decree = policy.genesis_decree("synology-nas-001")
        decree["mode"] = "sharded"
        ok, reason = policy.validate_decree(decree)
        self.assertFalse(ok)
        self.assertEqual(reason, "below_replica_floor")

    def test_sharded_decree_requires_three_copies_per_shard(self):
        hosts = [
            {"hostId": "a", "shards": [0, 1]},
            {"hostId": "b", "shards": [0, 1]},
            {"hostId": "c", "shards": [0]},
        ]
        decree = {
            "v": 1,
            "kind": policy.DECREE_KIND,
            "issuedAt": "",
            "issuedBy": "main",
            "minReplicas": 3,
            "mode": "sharded",
            "shardCount": 2,
            "hosts": hosts,
        }
        ok, reason = policy.validate_decree(decree)
        self.assertFalse(ok)
        self.assertEqual(reason, "shard_under_replicated")

        for host in hosts:
            host["shards"] = ["*"]
        ok, reason = policy.validate_decree(decree)
        self.assertTrue(ok, reason)

    def test_drop_refuses_when_only_one_copy_exists(self):
        decree = policy.genesis_decree("synology-nas-001")
        inventories = {"synology-nas-001": {"listing:one"}}
        allowed, reason = policy.can_drop_object(
            "synology-nas-001",
            "listing:one",
            inventories,
            decree,
        )
        self.assertFalse(allowed)
        self.assertEqual(reason, "below_replica_floor")

    def test_drop_allowed_only_after_sharded_decree_and_floor(self):
        decree = {
            "v": 1,
            "kind": policy.DECREE_KIND,
            "issuedAt": "",
            "issuedBy": "main",
            "minReplicas": 3,
            "mode": "sharded",
            "shardCount": 1,
            "hosts": [
                {"hostId": "a", "shards": [0]},
                {"hostId": "b", "shards": [0]},
                {"hostId": "c", "shards": [0]},
                {"hostId": "d", "shards": []},
            ],
        }
        inventories = {
            "a": {"listing:one"},
            "b": {"listing:one"},
            "c": {"listing:one"},
            "d": {"listing:one"},
        }
        allowed, reason = policy.can_drop_object("d", "listing:one", inventories, decree)
        self.assertTrue(allowed, reason)
        allowed, reason = policy.can_drop_object("a", "listing:one", inventories, decree)
        self.assertFalse(allowed)
        self.assertEqual(reason, "host_still_assigned")

    def test_adding_hosts_spreads_read_index(self):
        first = policy.choose_host_index("listing-42", 1)
        self.assertEqual(first, 0)
        indexes = {policy.choose_host_index(f"listing-{index}", 4) for index in range(40)}
        self.assertGreater(len(indexes), 1)

    def test_sanitize_strips_secrets(self):
        record = policy.sanitize_public_record(
            "listing",
            {
                "id": "abc",
                "title": "Lamp",
                "email": "hidden@example.com",
                "password": "nope",
                "accessToken": "tok",
                "imageBytes": "AAAA",
            },
        )
        self.assertEqual(record["id"], "abc")
        self.assertNotIn("email", record)
        self.assertNotIn("password", record)
        self.assertNotIn("accessToken", record)
        self.assertNotIn("imageBytes", record)


if __name__ == "__main__":
    unittest.main()
