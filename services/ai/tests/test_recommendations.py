import pytest
from app.recommender.engine import (
    run_ai_recommendation_engine,
    compute_content_type_ranking,
    update_creator_feedback,
    get_creator_preferences
)
from app.decomposer.task_decomposer import decompose_campaign_goal
from app.analysis.performance_score import normalize_account_performance_scores, compute_post_engagement
from app.analysis.content_analyzer import extract_tfidf_topics, analyze_caption_sentiment, extract_hashtag_clusters


@pytest.fixture
def test_posts():
    return [
        {"caption": "Mastering Python tips and automation tricks #python #coding #tech", "likes": 500, "comments": 40, "reach": 4000, "media_type": "reel"},
        {"caption": "Clean workspace aesthetic review and accessories #desk #tech #aesthetic", "likes": 400, "comments": 25, "reach": 3500, "media_type": "carousel"},
        {"caption": "Why you should learn SQL in 2026 #coding #sql #database", "likes": 650, "comments": 60, "reach": 5000, "media_type": "reel"},
        {"caption": "Top monitors for productivity #desk #setup", "likes": 300, "comments": 15, "reach": 2800, "media_type": "image"}
    ]


@pytest.mark.asyncio
async def test_algorithm_2_recommendation_types(test_posts):
    """Verifies Algorithm 2 handles caption, schedule, and content_type per SRDS 5.6.2."""
    account = {"handle": "dev_guru", "followers": 15000, "niche": "Tech & Programming"}

    # 1. Caption recommendation
    res_cap = await run_ai_recommendation_engine(account, test_posts, recommendation_type="caption")
    assert res_cap["status"] == "success"
    assert len(res_cap["data"]["caption_drafts"]) == 3
    for draft in res_cap["data"]["caption_drafts"]:
        assert "caption" in draft
        assert "hook_type" in draft
        assert len(draft["hashtags"]) > 0

    # 2. Content Type recommendation
    res_ct = await run_ai_recommendation_engine(account, test_posts, recommendation_type="content_type")
    assert res_ct["status"] == "success"
    assert len(res_ct["data"]["ranked_formats"]) >= 3
    assert "confidence_interval_80" in res_ct["data"]["ranked_formats"][0]

    # 3. Schedule recommendation
    res_sched = await run_ai_recommendation_engine(account, test_posts, recommendation_type="schedule")
    assert res_sched["status"] == "success"
    assert len(res_sched["data"]["primary_schedule"]["slots"]) == 5


@pytest.mark.asyncio
async def test_feedback_loop_preference_learning(test_posts):
    """Verifies FR-24: Accepting or rejecting recommendations updates creator preference weights."""
    handle = "test_feedback_creator"
    account = {"handle": handle, "followers": 20000}

    rec = await run_ai_recommendation_engine(account, test_posts, recommendation_type="content_type")
    rec_id = rec["recommendation_id"]

    # Accept recommendation
    fb_res = update_creator_feedback(
        recommendation_id=rec_id,
        handle=handle,
        accepted=True,
        feedback_text="Loved this format ranking"
    )
    assert fb_res["status"] == "success"
    assert fb_res["preference_re_ranking_active"] is True

    # Verify updated preferences stored in DB
    prefs = get_creator_preferences(handle)
    assert len(prefs["preferred_media_types"]) > 0


@pytest.mark.asyncio
async def test_task_decomposition_goal_to_tasks():
    """Verifies FR-22: Decomposing marketing goal into discrete scheduled tasks."""
    account = {"handle": "brand_creator", "followers": 30000}
    goal = "Launch new SaaS analytics dashboard over next 2 weeks"

    res = await decompose_campaign_goal(
        account=account,
        goal=goal,
        platform="instagram",
        horizon_days=14,
        target_posts=4
    )
    assert res["status"] == "success"
    assert res["total_tasks"] == 4
    for task in res["tasks"]:
        assert "id" in task
        assert "title" in task
        assert "due_date" in task
        assert "media_type" in task
        assert task["status"] == "PENDING"
