"""
Phase 7 Optimizer Comprehensive Benchmark Comparison:
Compares on identical inputs across 5 random seeds ([42, 123, 456, 789, 1024]):

PROBLEM VARIANT 1: Linear Bayesian Shrinkage Scores (Independent Slots)
- Exact Global Optimum (MILP via scipy.optimize.milp / HiGHS)
- Tuned QUBO + SA (A=1.2*max_v, B=2.0*max_v, reads=100, sweeps=500)
- Untuned QUBO + SA (A=25, B=30, reads=250, sweeps=1000)
- Greedy Baseline (sorts by v_s, picks highest feasible)
- Classical Simulated Annealing (SRDS Alg 1 slot swapping)
- Random Feasible Baseline (uniform rejection sampling)

PROBLEM VARIANT 2: Pairwise Content & Audience Dynamics (Fatigue & Diversity)
- Exact Global Optimum (Exact Branch & Bound)
- Tuned QUBO + SA (encodes pairwise fatigue and diversity terms directly in Q)
- Greedy Baseline (myopic to pairwise interactions)
- Classical Simulated Annealing (evaluates quadratic objective during swaps)
- Random Feasible Baseline

Outputs full comparison tables with mean ± std and optimality gaps.
Saves json to services/ai/data/phase7_comparison_results.json
"""

import sys
import time
import json
import random
from pathlib import Path
from typing import Dict, Any, List, Set, Tuple
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds
import dimod
from dwave.samplers import SimulatedAnnealingSampler

AI_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AI_DIR))

from app.optimizer.qubo_optimizer import (
    compute_slot_scores_with_shrinkage,
    slot_to_key,
    key_to_slot,
    TOTAL_SLOTS,
    DAYS_PER_WEEK,
    HOURS_PER_DAY
)
from app.optimizer.simulated_annealing import (
    is_valid_schedule,
    schedule_score
)
from app.analysis.performance_score import normalize_account_performance_scores


def generate_benchmark_inputs(num_posts: int = 50, seed: int = 42) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    rng = random.Random(seed)
    account = {
        "handle": "benchmark_creator",
        "platform": "instagram",
        "followers": 15000,
        "niche": "Tech & Creator"
    }
    posts = []
    days = ["2026-10-01", "2026-10-05", "2026-10-10", "2026-10-15", "2026-10-20"]
    for i in range(num_posts):
        day_str = rng.choice(days)
        h = rng.randint(0, 23)
        m = rng.randint(0, 59)
        posts.append({
            "id": f"post_bench_{i}",
            "posted_at": f"{day_str}T{h:02d}:{m:02d}:00Z",
            "likes": rng.randint(150, 1200),
            "comments": rng.randint(10, 80),
            "reach": rng.randint(2000, 8000),
            "perf_score": rng.uniform(0.2, 0.95),
            "media_type": rng.choice(["reel", "carousel", "image"])
        })
    return account, posts


def get_slot_format(h: int) -> str:
    if 17 <= h <= 21:
        return "reel"
    elif 11 <= h <= 14:
        return "carousel"
    return "image"


def compute_pairwise_interaction(s1_key: str, s2_key: str) -> float:
    d1, h1 = key_to_slot(s1_key)
    d2, h2 = key_to_slot(s2_key)
    fmt1 = get_slot_format(h1)
    fmt2 = get_slot_format(h2)

    day_diff = abs(d1 - d2)
    if day_diff > 3:
        day_diff = 7 - day_diff

    val = 0.0
    # 1. Adjacent day fatigue penalty (-0.25 base, -0.40 extra if same format)
    if day_diff == 1:
        val -= 0.25
        if fmt1 == fmt2:
            val -= 0.40
    # 2. Optimal 2-3 day pacing bonus
    elif day_diff in (2, 3):
        val += 0.25

    # 3. Format diversity bonus
    if fmt1 != fmt2:
        val += 0.30

    return val


def solve_variant1_exact_milp(
    v_scores: Dict[str, float],
    active_keys: List[str],
    K: int,
    min_gap_hours: int
) -> Tuple[float, List[str], float]:
    t0 = time.perf_counter()
    n = len(active_keys)
    c = -np.array([v_scores[k] for k in active_keys])
    integrality = np.ones(n)
    bounds = Bounds(0, 1)

    A_eq = [np.ones(n)]
    b_l = [K]
    b_u = [K]

    for i in range(n):
        d1, h1 = key_to_slot(active_keys[i])
        for j in range(i + 1, n):
            d2, h2 = key_to_slot(active_keys[j])
            if d1 == d2 and abs(h1 - h2) < min_gap_hours:
                row = np.zeros(n)
                row[i] = 1.0
                row[j] = 1.0
                A_eq.append(row)
                b_l.append(0.0)
                b_u.append(1.0)

    res = milp(c=c, integrality=integrality, bounds=bounds, constraints=LinearConstraint(np.array(A_eq), b_l, b_u))
    opt_score = -res.fun
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    chosen = [active_keys[i] for i in range(n) if res.x[i] > 0.5]
    return float(opt_score), chosen, float(elapsed_ms)


def solve_variant2_exact_bb(
    v_scores: Dict[str, float],
    active_keys: List[str],
    K: int,
    min_gap_hours: int
) -> Tuple[float, List[str], float]:
    t0 = time.perf_counter()
    best_score = float("-inf")
    best_sched = []

    day_slots = {d: [k for k in active_keys if key_to_slot(k)[0] == d] for d in range(7)}

    def eval_candidate(slots):
        sc = sum(v_scores[s] for s in slots)
        for i in range(len(slots)):
            for j in range(i + 1, len(slots)):
                sc += compute_pairwise_interaction(slots[i], slots[j])
        return sc

    def branch(day_idx, current_slots, current_score):
        nonlocal best_score, best_sched
        slots_left = K - len(current_slots)
        days_left = 7 - day_idx
        if slots_left == 0:
            if current_score > best_score:
                best_score = current_score
                best_sched = list(current_slots)
            return
        if slots_left > days_left * 2:
            return

        # Pruning bound
        max_remaining = slots_left * 1.0 + (slots_left * len(current_slots) + slots_left * (slots_left - 1) / 2) * 0.55
        if current_score + max_remaining <= best_score:
            return

        # 0 slots today
        branch(day_idx + 1, current_slots, current_score)

        # 1 slot today
        if slots_left >= 1:
            for s in day_slots[day_idx]:
                delta = v_scores[s] + sum(compute_pairwise_interaction(s, p) for p in current_slots)
                branch(day_idx + 1, current_slots + [s], current_score + delta)

        # 2 slots today
        if slots_left >= 2:
            cand = day_slots[day_idx]
            for i in range(len(cand)):
                s1 = cand[i]
                h1 = key_to_slot(s1)[1]
                for j in range(i + 1, len(cand)):
                    s2 = cand[j]
                    h2 = key_to_slot(s2)[1]
                    if abs(h1 - h2) >= min_gap_hours:
                        delta = (
                            v_scores[s1] + v_scores[s2]
                            + sum(compute_pairwise_interaction(s1, p) for p in current_slots)
                            + sum(compute_pairwise_interaction(s2, p) for p in current_slots)
                            + compute_pairwise_interaction(s1, s2)
                        )
                        branch(day_idx + 1, current_slots + [s1, s2], current_score + delta)

    branch(0, [], 0.0)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    return float(best_score), best_sched, float(elapsed_ms)


def run_full_phase7_benchmark(seeds: List[int] = [42, 123, 456, 789, 1024]) -> Dict[str, Any]:
    account, raw_posts = generate_benchmark_inputs(num_posts=45, seed=42)
    normalized_posts = normalize_account_performance_scores(raw_posts, account["followers"])
    v_scores = compute_slot_scores_with_shrinkage(normalized_posts)

    K = 5
    min_gap_hours = 4
    blackout_keys = {slot_to_key(d, h) for d in range(7) for h in range(7)}
    active_keys = sorted([k for k in v_scores.keys() if k not in blackout_keys])
    n = len(active_keys)
    max_v = max([v_scores[k] for k in active_keys], default=1.0)

    # -------------------------------------------------------------------------
    # 1. EXACT OPTIMA
    # -------------------------------------------------------------------------
    opt1_val, opt1_slots, opt1_time = solve_variant1_exact_milp(v_scores, active_keys, K, min_gap_hours)
    opt2_val, opt2_slots, opt2_time = solve_variant2_exact_bb(v_scores, active_keys, K, min_gap_hours)

    print(f"Variant 1 Exact Global Optimum: {opt1_val:.4f} (MILP runtime: {opt1_time:.1f}ms)")
    print(f"Variant 2 Exact Global Optimum: {opt2_val:.4f} (B&B runtime: {opt2_time:.1f}ms)")

    # -------------------------------------------------------------------------
    # 2. RUN ALL METHODS ACROSS 5 SEEDS
    # -------------------------------------------------------------------------
    v1_results = {
        "Exact_MILP": {"scores": [opt1_val]*len(seeds), "runtimes": [opt1_time]*len(seeds), "feas": [100.0]*len(seeds)},
        "Tuned_QUBO_SA": {"scores": [], "runtimes": [], "feas": []},
        "Untuned_QUBO_SA": {"scores": [], "runtimes": [], "feas": []},
        "Greedy_Baseline": {"scores": [], "runtimes": [], "feas": []},
        "Classical_SA": {"scores": [], "runtimes": [], "feas": []},
        "Random_Feasible": {"scores": [], "runtimes": [], "feas": []}
    }

    v2_results = {
        "Exact_BB": {"scores": [opt2_val]*len(seeds), "runtimes": [opt2_time]*len(seeds), "feas": [100.0]*len(seeds)},
        "Tuned_QUBO_SA": {"scores": [], "runtimes": [], "feas": []},
        "Greedy_Baseline": {"scores": [], "runtimes": [], "feas": []},
        "Classical_SA": {"scores": [], "runtimes": [], "feas": []},
        "Random_Feasible": {"scores": [], "runtimes": [], "feas": []}
    }

    def eval_v2(slots):
        sc = sum(v_scores[s] for s in slots)
        for i in range(len(slots)):
            for j in range(i + 1, len(slots)):
                sc += compute_pairwise_interaction(slots[i], slots[j])
        return sc

    for s_idx, seed in enumerate(seeds, 1):
        print(f"\n--- Running Seed {seed} ({s_idx}/{len(seeds)}) ---")

        # --- A. Greedy Baseline ---
        t_g0 = time.perf_counter()
        sorted_slots = sorted(active_keys, key=lambda k: v_scores[k], reverse=True)
        greedy_chosen = []
        day_dict = {d: [] for d in range(7)}
        for s in sorted_slots:
            if len(greedy_chosen) >= K:
                break
            d, h = key_to_slot(s)
            if not any(abs(h - eh) < min_gap_hours for eh in day_dict[d]):
                greedy_chosen.append(s)
                day_dict[d].append(h)
        g_time = (time.perf_counter() - t_g0) * 1000.0
        g_score1 = sum(v_scores[s] for s in greedy_chosen)
        g_score2 = eval_v2(greedy_chosen)

        v1_results["Greedy_Baseline"]["scores"].append(g_score1)
        v1_results["Greedy_Baseline"]["runtimes"].append(g_time)
        v1_results["Greedy_Baseline"]["feas"].append(100.0)

        v2_results["Greedy_Baseline"]["scores"].append(g_score2)
        v2_results["Greedy_Baseline"]["runtimes"].append(g_time)
        v2_results["Greedy_Baseline"]["feas"].append(100.0)

        # --- B. Random Feasible ---
        t_r0 = time.perf_counter()
        rng = random.Random(seed)
        r_chosen = []
        for _ in range(1000):
            shuf = list(active_keys)
            rng.shuffle(shuf)
            cand = []
            d_d = {d: [] for d in range(7)}
            for s in shuf:
                d, h = key_to_slot(s)
                if not any(abs(h - eh) < min_gap_hours for eh in d_d[d]):
                    cand.append(s)
                    d_d[d].append(h)
                    if len(cand) == K:
                        break
            if len(cand) == K:
                r_chosen = cand
                break
        r_time = (time.perf_counter() - t_r0) * 1000.0
        r_score1 = sum(v_scores[s] for s in r_chosen)
        r_score2 = eval_v2(r_chosen)

        v1_results["Random_Feasible"]["scores"].append(r_score1)
        v1_results["Random_Feasible"]["runtimes"].append(r_time)
        v1_results["Random_Feasible"]["feas"].append(100.0)

        v2_results["Random_Feasible"]["scores"].append(r_score2)
        v2_results["Random_Feasible"]["runtimes"].append(r_time)
        v2_results["Random_Feasible"]["feas"].append(100.0)

        # --- C. Classical Simulated Annealing (Alg 1) ---
        # Variant 1
        t_csa0 = time.perf_counter()
        csa1_curr = list(r_chosen)
        csa1_score = r_score1
        best1 = list(csa1_curr)
        best1_sc = csa1_score
        T, T_min, alpha = 2.0, 0.01, 0.95
        while T > T_min:
            for _ in range(50):
                cand = list(csa1_curr)
                idx = rng.randint(0, K - 1)
                new_s = rng.choice(active_keys)
                if new_s in cand:
                    continue
                cand[idx] = new_s
                if is_valid_schedule(cand, min_gap_hours, blackout_keys):
                    sc = sum(v_scores[s] for s in cand)
                    delta = sc - csa1_score
                    if delta > 0 or rng.random() < np.exp(delta / T):
                        csa1_curr = cand
                        csa1_score = sc
                        if csa1_score > best1_sc:
                            best1_sc = csa1_score
                            best1 = list(cand)
            T *= alpha
        csa1_time = (time.perf_counter() - t_csa0) * 1000.0

        v1_results["Classical_SA"]["scores"].append(best1_sc)
        v1_results["Classical_SA"]["runtimes"].append(csa1_time)
        v1_results["Classical_SA"]["feas"].append(100.0)

        # Classical SA Variant 2
        t_csa2_0 = time.perf_counter()
        csa2_curr = list(r_chosen)
        csa2_score = r_score2
        best2 = list(csa2_curr)
        best2_sc = csa2_score
        T = 2.0
        while T > T_min:
            for _ in range(50):
                cand = list(csa2_curr)
                idx = rng.randint(0, K - 1)
                new_s = rng.choice(active_keys)
                if new_s in cand:
                    continue
                cand[idx] = new_s
                if is_valid_schedule(cand, min_gap_hours, blackout_keys):
                    sc = eval_v2(cand)
                    delta = sc - csa2_score
                    if delta > 0 or rng.random() < np.exp(delta / T):
                        csa2_curr = cand
                        csa2_score = sc
                        if csa2_score > best2_sc:
                            best2_sc = csa2_score
                            best2 = list(cand)
            T *= alpha
        csa2_time = (time.perf_counter() - t_csa2_0) * 1000.0

        v2_results["Classical_SA"]["scores"].append(best2_sc)
        v2_results["Classical_SA"]["runtimes"].append(csa2_time)
        v2_results["Classical_SA"]["feas"].append(100.0)

        # --- D. Untuned QUBO (A=25, B=30) on Variant 1 ---
        t_uq0 = time.perf_counter()
        A_old, B_old = 25.0, 30.0
        lin_old = {k: -v_scores[k] + A_old * (1.0 - 2.0 * K) for k in active_keys}
        quad_old = {}
        for i in range(n):
            k1 = active_keys[i]
            d1, h1 = key_to_slot(k1)
            for j in range(i + 1, n):
                k2 = active_keys[j]
                d2, h2 = key_to_slot(k2)
                w = 2.0 * A_old
                if d1 == d2 and abs(h1 - h2) < min_gap_hours:
                    w += B_old
                quad_old[(k1, k2)] = w
        bqm_old = dimod.BinaryQuadraticModel(lin_old, quad_old, A_old * (K ** 2), dimod.BINARY)
        sampler = SimulatedAnnealingSampler()
        ss_old = sampler.sample(bqm_old, num_reads=200, num_sweeps=500, seed=seed)
        uq_time = (time.perf_counter() - t_uq0) * 1000.0
        best_uq_sc = 0.0
        for sample, energy in ss_old.data(['sample', 'energy']):
            ch = [k for k, v in sample.items() if v == 1]
            if len(ch) == K and is_valid_schedule(ch, min_gap_hours, blackout_keys):
                best_uq_sc = max(best_uq_sc, sum(v_scores[k] for k in ch))
        v1_results["Untuned_QUBO_SA"]["scores"].append(best_uq_sc)
        v1_results["Untuned_QUBO_SA"]["runtimes"].append(uq_time)
        v1_results["Untuned_QUBO_SA"]["feas"].append(100.0 if best_uq_sc > 0 else 0.0)

        # --- E. Tuned QUBO (A=1.2*max_v, B=2.0*max_v) on Variant 1 ---
        t_tq0 = time.perf_counter()
        A_tune = round(1.2 * max_v, 4)
        B_tune = round(2.0 * max_v, 4)
        lin_tune = {k: -v_scores[k] + A_tune * (1.0 - 2.0 * K) for k in active_keys}
        quad_tune = {}
        for i in range(n):
            k1 = active_keys[i]
            d1, h1 = key_to_slot(k1)
            for j in range(i + 1, n):
                k2 = active_keys[j]
                d2, h2 = key_to_slot(k2)
                w = 2.0 * A_tune
                if d1 == d2 and abs(h1 - h2) < min_gap_hours:
                    w += B_tune
                quad_tune[(k1, k2)] = w
        bqm_tune = dimod.BinaryQuadraticModel(lin_tune, quad_tune, A_tune * (K ** 2), dimod.BINARY)
        ss_tune = sampler.sample(bqm_tune, num_reads=100, num_sweeps=500, seed=seed)
        tq_time = (time.perf_counter() - t_tq0) * 1000.0
        best_tq_sc = 0.0
        for sample, energy in ss_tune.data(['sample', 'energy']):
            ch = [k for k, v in sample.items() if v == 1]
            if len(ch) == K and is_valid_schedule(ch, min_gap_hours, blackout_keys):
                best_tq_sc = max(best_tq_sc, sum(v_scores[k] for k in ch))
        v1_results["Tuned_QUBO_SA"]["scores"].append(best_tq_sc)
        v1_results["Tuned_QUBO_SA"]["runtimes"].append(tq_time)
        v1_results["Tuned_QUBO_SA"]["feas"].append(100.0 if best_tq_sc > 0 else 0.0)

        # --- F. Tuned QUBO on Variant 2 ---
        t_tq2_0 = time.perf_counter()
        A_v2 = round(4.5 * max_v, 4)
        B_v2 = round(3.0 * max_v, 4)
        lin_v2 = {k: -v_scores[k] + A_v2 * (1.0 - 2.0 * K) for k in active_keys}
        quad_v2 = {}
        for i in range(n):
            k1 = active_keys[i]
            d1, h1 = key_to_slot(k1)
            for j in range(i + 1, n):
                k2 = active_keys[j]
                d2, h2 = key_to_slot(k2)
                inter = compute_pairwise_interaction(k1, k2)
                w = -inter + 2.0 * A_v2
                if d1 == d2 and abs(h1 - h2) < min_gap_hours:
                    w += B_v2
                quad_v2[(k1, k2)] = w
        bqm_v2 = dimod.BinaryQuadraticModel(lin_v2, quad_v2, A_v2 * (K ** 2), dimod.BINARY)
        ss_v2 = sampler.sample(bqm_v2, num_reads=200, num_sweeps=500, seed=seed)
        tq2_time = (time.perf_counter() - t_tq2_0) * 1000.0
        best_tq2_sc = 0.0
        for sample, energy in ss_v2.data(['sample', 'energy']):
            ch = [k for k, v in sample.items() if v == 1]
            if len(ch) == K and is_valid_schedule(ch, min_gap_hours, blackout_keys):
                best_tq2_sc = max(best_tq2_sc, eval_v2(ch))
        v2_results["Tuned_QUBO_SA"]["scores"].append(best_tq2_sc)
        v2_results["Tuned_QUBO_SA"]["runtimes"].append(tq2_time)
        v2_results["Tuned_QUBO_SA"]["feas"].append(100.0 if best_tq2_sc > 0 else 0.0)

    # -------------------------------------------------------------------------
    # 3. COMPILE SUMMARY AND OPTIMALITY GAPS
    # -------------------------------------------------------------------------
    def summarize(res_dict, opt_val):
        out = {}
        for name, data in res_dict.items():
            sc = data["scores"]
            rt = data["runtimes"]
            m_sc = float(np.mean(sc))
            s_sc = float(np.std(sc))
            m_rt = float(np.mean(rt))
            s_rt = float(np.std(rt))
            feas = float(np.mean(data["feas"]))
            gap_pct = max(0.0, ((opt_val - m_sc) / opt_val) * 100.0) if opt_val > 0 else 0.0
            out[name] = {
                "score_mean": round(m_sc, 4),
                "score_std": round(s_sc, 4),
                "optimality_gap_pct": round(gap_pct, 2),
                "runtime_ms_mean": round(m_rt, 1),
                "runtime_ms_std": round(s_rt, 1),
                "feasibility_pct": round(feas, 1),
                "scores": [round(x, 4) for x in sc],
                "runtimes_ms": [round(x, 1) for x in rt]
            }
        return out

    summary_v1 = summarize(v1_results, opt1_val)
    summary_v2 = summarize(v2_results, opt2_val)

    print("\n" + "=" * 90)
    print("PROBLEM VARIANT 1: INDEPENDENT LINEAR SLOT VALUES")
    print(f"Optimal Value V* = {opt1_val:.4f}")
    print("=" * 90)
    print(f"{'Method':<20} | {'Score (Mean ± Std)':<22} | {'Gap to Opt':<12} | {'Runtime (ms)':<20} | {'Feasibility':<12}")
    print("-" * 90)
    for k, v in summary_v1.items():
        print(f"{k:<20} | {v['score_mean']:.4f} ± {v['score_std']:.4f}     | {v['optimality_gap_pct']:>6.2f}%     | {v['runtime_ms_mean']:>7.1f} ± {v['runtime_ms_std']:<5.1f} ms | {v['feasibility_pct']:>5.1f}%")

    print("\n" + "=" * 90)
    print("PROBLEM VARIANT 2: PAIRWISE CONTENT FATIGUE & DIVERSITY DYNAMICS")
    print(f"Optimal Value V* = {opt2_val:.4f}")
    print("=" * 90)
    print(f"{'Method':<20} | {'Score (Mean ± Std)':<22} | {'Gap to Opt':<12} | {'Runtime (ms)':<20} | {'Feasibility':<12}")
    print("-" * 90)
    for k, v in summary_v2.items():
        print(f"{k:<20} | {v['score_mean']:.4f} ± {v['score_std']:.4f}     | {v['optimality_gap_pct']:>6.2f}%     | {v['runtime_ms_mean']:>7.1f} ± {v['runtime_ms_std']:<5.1f} ms | {v['feasibility_pct']:>5.1f}%")

    full_payload = {
        "seeds": seeds,
        "variant_1_independent_slots": {
            "exact_optimum": round(opt1_val, 4),
            "benchmark_summary": summary_v1
        },
        "variant_2_pairwise_interactions": {
            "exact_optimum": round(opt2_val, 4),
            "benchmark_summary": summary_v2
        }
    }

    out_path = AI_DIR / "data" / "phase7_comparison_results.json"
    with open(out_path, "w") as f:
        json.dump(full_payload, f, indent=2)
    print(f"\nFull comparison results saved to {out_path}")

    return full_payload


if __name__ == "__main__":
    run_full_phase7_benchmark()
