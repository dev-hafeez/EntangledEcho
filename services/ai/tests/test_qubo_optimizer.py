import pytest
import time
from app.optimizer.qubo_optimizer import run_qubo_optimization, key_to_slot
from app.optimizer.simulated_annealing import run_classical_simulated_annealing
from app.optimizer.benchmark import compare_optimizers


@pytest.fixture
def sample_creator_data():
    account = {"handle": "tech_creator", "followers": 50000}
    posts = [
        {"posted_at": "2026-10-20T19:00:00Z", "perf_score": 0.92, "likes": 5000, "comments": 200, "reach": 40000, "caption": "Tech setup review #tech"},
        {"posted_at": "2026-10-18T14:00:00Z", "perf_score": 0.75, "likes": 3200, "comments": 150, "reach": 30000, "caption": "Workspace tour #desk"},
        {"posted_at": "2026-10-15T21:00:00Z", "perf_score": 0.88, "likes": 4800, "comments": 190, "reach": 38000, "caption": "Coding tutorial #python"},
        {"posted_at": "2026-10-12T12:00:00Z", "perf_score": 0.60, "likes": 2500, "comments": 80, "reach": 25000, "caption": "Morning coffee #dev"},
        {"posted_at": "2026-10-09T18:00:00Z", "perf_score": 0.84, "likes": 4100, "comments": 160, "reach": 35000, "caption": "Top gadgets #gear"}
    ]
    return account, posts


def test_qubo_optimizer_constraints(sample_creator_data):
    """Verifies that QUBO schedule strictly satisfies post cap and min_gap constraints (FR-18)."""
    account, posts = sample_creator_data
    target_posts = 5
    min_gap = 4

    result = run_qubo_optimization(
        account=account,
        posts=posts,
        target_posts_per_week=target_posts,
        min_gap_hours=min_gap,
        num_reads=150
    )

    assert result["status"] == "success"
    slots = result["primary_schedule"]["slots"]
    assert len(slots) == target_posts, f"Expected {target_posts} slots, got {len(slots)}"

    # Check minimum gap constraint on the same day
    day_slots = {}
    for s in slots:
        d = s["day_index"]
        h = s["hour"]
        if d not in day_slots:
            day_slots[d] = []
        day_slots[d].append(h)

    for d, hours in day_slots.items():
        sorted_h = sorted(hours)
        for i in range(len(sorted_h) - 1):
            gap = sorted_h[i + 1] - sorted_h[i]
            assert gap >= min_gap, f"Constraint violated on day {d}: gap {gap} < {min_gap}"


def test_qubo_optimizer_blackout_windows(sample_creator_data):
    """Verifies that blackout slots are never chosen in the recommended schedule."""
    account, posts = sample_creator_data
    # Blackout late night hours (00:00 - 08:00)
    blackouts = [{"start_hour": 0, "end_hour": 8}]

    result = run_qubo_optimization(
        account=account,
        posts=posts,
        target_posts_per_week=4,
        min_gap_hours=3,
        blackout_slots=blackouts,
        num_reads=150
    )

    assert result["status"] == "success"
    for s in result["primary_schedule"]["slots"]:
        assert s["hour"] > 8, f"Blackout slot chosen: hour {s['hour']}"


def test_qubo_ranked_alternatives_and_confidence(sample_creator_data):
    """Verifies generation of 3 distinct alternatives (FR-19) and bootstrap confidence metrics (FR-20)."""
    account, posts = sample_creator_data

    result = run_qubo_optimization(
        account=account,
        posts=posts,
        target_posts_per_week=5,
        min_gap_hours=4,
        num_reads=150
    )

    assert "alternatives" in result
    assert len(result["alternatives"]) == 3, "Expected exactly 3 distinct alternative schedules (FR-19)"

    # Verify primary schedule and alternatives have different slot sets
    primary_keys = set(s["slot_key"] for s in result["primary_schedule"]["slots"])
    for i, alt in enumerate(result["alternatives"]):
        alt_keys = set(s["slot_key"] for s in alt["slots"])
        assert alt_keys != primary_keys, f"Alternative {i} is identical to primary schedule"

    # Verify confidence metrics
    assert 0.0 <= result["schedule_confidence"] <= 100.0
    for s in result["primary_schedule"]["slots"]:
        assert 0.0 <= s["confidence_score"] <= 100.0


def test_optimizer_speed_nfr(sample_creator_data):
    """Verifies NFR 4.1.3: Schedule optimization completes well within 10 seconds."""
    account, posts = sample_creator_data
    t_start = time.perf_counter()

    result = run_qubo_optimization(
        account=account,
        posts=posts,
        target_posts_per_week=7,
        min_gap_hours=3,
        num_reads=200
    )
    duration = time.perf_counter() - t_start
    assert duration < 10.0, f"Optimization took {duration}s, must be < 10.0s (SRDS 4.1.3)"
    assert result["status"] == "success"


def test_classical_simulated_annealing(sample_creator_data):
    """Verifies classical SA baseline algorithm (SRDS 5.6.1 Algorithm 1)."""
    account, posts = sample_creator_data
    res = run_classical_simulated_annealing(
        account=account,
        posts=posts,
        target_posts_per_week=4,
        min_gap_hours=4
    )
    assert res["status"] == "success"
    assert len(res["primary_schedule"]["slots"]) == 4
    assert len(res["alternatives"]) == 3


def test_optimizer_benchmark_comparator(sample_creator_data):
    """Verifies comparator running both QUBO and SA side-by-side."""
    account, posts = sample_creator_data
    bench = compare_optimizers(account, posts, target_posts_per_week=5)
    assert bench["status"] == "success"
    assert "qubo_quantum_inspired" in bench["benchmark_summary"]
    assert "classical_simulated_annealing" in bench["benchmark_summary"]
    assert bench["benchmark_summary"]["qubo_quantum_inspired"]["execution_time_ms"] < 10000
