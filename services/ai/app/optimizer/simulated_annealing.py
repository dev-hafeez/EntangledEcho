"""
Classical Simulated Annealing Schedule Optimizer (SRDS 5.6.1 Algorithm 1)

Direct reference implementation of Algorithm 1 from Section 5.6.1 of srdsfyp.pdf:
Swaps random slots with exponential cooling schedule and constraint verification.
"""

import time
import math
import random
from typing import Dict, Any, List, Tuple, Set, Optional
from datetime import datetime
import numpy as np

from app.analysis.performance_score import normalize_account_performance_scores
from app.optimizer.qubo_optimizer import (
    compute_slot_scores_with_shrinkage,
    slot_to_key,
    key_to_slot,
    DAY_NAMES
)


def is_valid_schedule(
    slots: List[str],
    min_gap_hours: int,
    blackout_keys: Set[str]
) -> bool:
    """Verifies that schedule does not violate blackout windows or min_gap_hours constraints."""
    # Check blackouts
    for s in slots:
        if s in blackout_keys:
            return False

    # Check minimum gap between posts on same day
    day_hours: Dict[int, List[int]] = {}
    for s in slots:
        d, h = key_to_slot(s)
        if d not in day_hours:
            day_hours[d] = []
        day_hours[d].append(h)

    for d, hours in day_hours.items():
        sorted_h = sorted(hours)
        for i in range(len(sorted_h) - 1):
            if abs(sorted_h[i + 1] - sorted_h[i]) < min_gap_hours:
                return False

    return True


def schedule_score(slots: List[str], v_scores: Dict[str, float]) -> float:
    """Calculates cumulative performance score of candidate schedule."""
    return sum(v_scores.get(s, 0.5) for s in slots)


def run_classical_simulated_annealing(
    account: Dict[str, Any],
    posts: List[Dict[str, Any]],
    target_posts_per_week: int = 5,
    min_gap_hours: int = 4,
    blackout_slots: Optional[List[Dict[str, Any]]] = None,
    t_initial: float = 1000.0,
    t_min: float = 0.05,
    cooling_rate: float = 0.995,
    seed: Optional[int] = 42
) -> Dict[str, Any]:
    """
    Executes Algorithm 1 from SRDS Section 5.6.1:
    1. Computes engagement_score for each time slot.
    2. Initializes random valid candidate_solution within constraints.
    3. Cools temperature T swapping two random slots.
    4. Generates k=3 alternative schedules by perturbing primary_schedule.
    5. Attaches confidence scores and returns ranked schedules.
    """
    t_start = time.perf_counter()
    if seed is not None:
        random.seed(seed)
        np.random.seed(seed)

    # 1. Normalize posts and compute slot scores v_s
    normalized_posts = normalize_account_performance_scores(
        list(posts), account.get("followers", 1000)
    )
    v_scores = compute_slot_scores_with_shrinkage(normalized_posts)

    # Blackout slots
    blackout_keys: Set[str] = set()
    if blackout_slots:
        for b in blackout_slots:
            if "day" in b and "hour" in b:
                blackout_keys.add(slot_to_key(int(b["day"]), int(b["hour"])))
            elif "start_hour" in b and "end_hour" in b:
                start_h = int(b["start_hour"])
                end_h = int(b["end_hour"])
                day_idx = int(b.get("day", 0)) if "day" in b else None
                days = [day_idx] if day_idx is not None else list(range(7))
                for d in days:
                    for h in range(start_h, end_h + 1):
                        blackout_keys.add(slot_to_key(d, h))

    all_candidate_slots = [s for s in v_scores.keys() if s not in blackout_keys]

    # 2. Initialize valid candidate_solution
    K = target_posts_per_week
    candidate: List[str] = []
    attempts = 0
    while len(candidate) < K and attempts < 1000:
        attempts += 1
        sampled = random.sample(all_candidate_slots, K)
        if is_valid_schedule(sampled, min_gap_hours, blackout_keys):
            candidate = sampled
            break

    if not candidate:
        # Fallback to spread days (Mon..Fri at 18:00)
        candidate = [slot_to_key(d % 7, 18) for d in range(K)]

    current_score = schedule_score(candidate, v_scores)
    best_solution = list(candidate)
    best_score = current_score

    # 3. Annealing loop (SRDS Step 5)
    T = t_initial
    iterations = 0
    available_to_swap = [s for s in all_candidate_slots if s not in candidate]

    while T > t_min and iterations < 10000:
        iterations += 1
        # a. Generate neighbor_solution by swapping two random time slots
        idx_to_remove = random.randint(0, len(candidate) - 1)
        if not available_to_swap:
            break
        replacement_slot = random.choice(available_to_swap)

        neighbor = list(candidate)
        neighbor[idx_to_remove] = replacement_slot

        # b. If neighbor_solution violates constraints: SKIP
        if not is_valid_schedule(neighbor, min_gap_hours, blackout_keys):
            T *= cooling_rate
            continue

        # c. Delta score
        neighbor_score = schedule_score(neighbor, v_scores)
        delta = neighbor_score - current_score

        # d. Acceptance criteria
        if delta > 0:
            candidate = neighbor
            current_score = neighbor_score
            if current_score > best_score:
                best_score = current_score
                best_solution = list(candidate)
        else:
            prob = math.exp(delta / max(T, 1e-4))
            if random.random() < prob:
                candidate = neighbor
                current_score = neighbor_score

        # e. Cool
        T *= cooling_rate

    # 4. Generate k=3 alternative schedules by perturbing primary schedule (Step 7)
    alternatives_raw: List[List[str]] = []
    for _ in range(3):
        perturbed = list(best_solution)
        for _ in range(50):
            r_idx = random.randint(0, len(perturbed) - 1)
            swap_in = random.choice(all_candidate_slots)
            test_sol = list(perturbed)
            test_sol[r_idx] = swap_in
            if (
                is_valid_schedule(test_sol, min_gap_hours, blackout_keys)
                and set(test_sol) != set(best_solution)
                and not any(set(test_sol) == set(a) for a in alternatives_raw)
            ):
                perturbed = test_sol
                break
        alternatives_raw.append(perturbed)

    def format_slots(slots: List[str], label: str) -> Dict[str, Any]:
        formatted = []
        confidences = []
        for s in sorted(slots, key=lambda x: (key_to_slot(x)[0], key_to_slot(x)[1])):
            d, h = key_to_slot(s)
            score = v_scores.get(s, 0.5)
            conf = round(65.0 + score * 30.0, 1)
            confidences.append(conf)
            formatted.append({
                "slot_key": s,
                "day_index": d,
                "day_name": DAY_NAMES[d],
                "hour": h,
                "time_utc": f"{h:02d}:00 UTC",
                "slot_score": score,
                "confidence_score": conf,
                "recommended_format": "REEL" if 17 <= h <= 21 else ("CAROUSEL" if 12 <= h <= 15 else "IMAGE")
            })
        return {
            "schedule_label": label,
            "slots": formatted,
            "mean_confidence": round(float(np.mean(confidences)), 1) if confidences else 75.0,
            "slots_count": len(formatted)
        }

    t_elapsed = round((time.perf_counter() - t_start) * 1000, 2)

    return {
        "status": "success",
        "algorithm": "Classical Simulated Annealing (SRDS 5.6.1 Algorithm 1)",
        "methodology": "Monte-Carlo stochastic temperature cooling with slot swapping",
        "primary_schedule": format_slots(best_solution, "Primary Schedule (Classical Annealing)"),
        "alternatives": [
            format_slots(alt, f"Alternative Schedule {i+1}")
            for i, alt in enumerate(alternatives_raw)
        ],
        "schedule_confidence": round(float(np.mean([v_scores.get(s, 0.5) for s in best_solution]) * 100), 1),
        "annealing_stats": {
            "iterations": iterations,
            "cooling_rate": cooling_rate,
            "final_temperature": round(T, 5),
            "execution_time_ms": t_elapsed,
            "best_score": round(best_score, 4)
        }
    }
