from types import SimpleNamespace
import unittest

def member(member_id: int, name: str):
    return SimpleNamespace(id=member_id, name=name)


def task(task_id: int, title: str, status: str, assignees, *, delayed=False, end_date=None):
    return SimpleNamespace(
        id=task_id,
        title=title,
        status=status,
        assigned_members=assignees,
        assigned_member=None,
        is_delayed=delayed,
        start_date=None,
        end_date=end_date,
    )


class DeliveryMapTests(unittest.TestCase):
    def test_rolls_up_projects_assignees_and_attention_tasks(self):
        from app.services.analytics import delivery_map

        lina = member(1, "Lina")
        yazan = member(2, "Yazan")
        milestone = SimpleNamespace(
            id=11,
            title="Delivery",
            workstream="project",
            tasks=[
                task(101, "Blocked integration", "blocked", [lina], delayed=True),
                task(102, "API build", "in_progress", [lina, yazan]),
                task(103, "Client handover", "todo", []),
                task(104, "Approved scope", "done", [yazan]),
            ],
        )
        project = SimpleNamespace(
            id=7,
            name="VerifyX",
            status="active",
            project_type="actual_project",
            project_manager=member(3, "Mahmoud"),
            milestones=[milestone],
        )

        result = delivery_map([project])

        self.assertEqual(len(result), 1)
        row = result[0]
        self.assertEqual(row["total_tasks"], 4)
        self.assertEqual(row["done_tasks"], 1)
        self.assertEqual(row["progress_pct"], 25)
        self.assertEqual(row["blocked_tasks"], 1)
        self.assertEqual(row["delayed_tasks"], 1)
        self.assertEqual(row["unassigned_tasks"], 1)
        self.assertEqual(row["project_manager_name"], "Mahmoud")
        self.assertEqual(row["assignees"][0]["name"], "Lina")
        self.assertEqual(row["assignees"][0]["open_tasks"], 2)
        self.assertEqual(row["attention_tasks"][0]["task_id"], 101)

    def test_excludes_archived_and_support_workspaces(self):
        from app.services.analytics import delivery_map

        support = SimpleNamespace(
            id=1,
            name="Support",
            status="active",
            project_type="maintenance_support",
            milestones=[],
        )
        archived = SimpleNamespace(
            id=2,
            name="Archive",
            status="archived",
            project_type="actual_project",
            milestones=[],
        )

        self.assertEqual(delivery_map([support, archived]), [])


if __name__ == "__main__":
    unittest.main()
