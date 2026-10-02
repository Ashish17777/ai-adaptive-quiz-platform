import gradio as gr
import json
import spaces

# Load Convai's Laya System 1 Decision Router
print("Initializing Laya Router...")
try:
    from laya import Router
    laya_router = Router(preload=True)
    print("Laya Router loaded successfully!")
except Exception as e:
    print("Warning: Laya package loading exception:", e)
    laya_router = None


@spaces.GPU
def adapt_difficulty(student_score: float, current_difficulty: str, streak: int, topic: str, total_answered: int):
    """
    Uses Laya System 1 Non-Autoregressive Decision Engine to adapt quiz difficulty.
    """
    levels = ["easy", "medium", "hard"]
    curr_idx = levels.index(current_difficulty) if current_difficulty in levels else 1

    if laya_router is not None:
        try:
            state = (
                f"Student answering '{topic}' questions. "
                f"Current difficulty: {current_difficulty}. "
                f"Accuracy rate: {student_score * 100:.1f}%. "
                f"Consecutive correct streak: {streak}. "
                f"Total questions completed: {total_answered}."
            )

            questions = {
                "difficulty_adjustment": {
                    "type": "choice",
                    "instructions": "Determine the optimal difficulty progression for the next question.",
                    "criteria": {
                        "promote": "Student demonstrates high mastery and deserves harder questions.",
                        "demote": "Student is struggling and needs easier questions to reinforce fundamentals.",
                        "maintain": "Student is in their zone of proximal development, keep current difficulty."
                    }
                },
                "student_readiness": {
                    "type": "score",
                    "instructions": "Evaluate the student's readiness level for advanced material.",
                    "criteria": ["Struggling", "Developing", "Proficient", "Mastered"]
                }
            }

            decision = laya_router.predict(state, questions)
            
            # Extract decision from Laya
            action = decision.get("difficulty_adjustment", {}).get("answer", "maintain")
            conf = decision.get("difficulty_adjustment", {}).get("confidence", 0.9)
            readiness = decision.get("student_readiness", {}).get("answer", "Developing")

            if action == "promote":
                new_level = levels[min(curr_idx + 1, 2)]
                reasoning = f"Laya Decision: Promoted due to demonstrated proficiency ({student_score*100:.0f}% accuracy, {streak} streak). Readiness: {readiness}."
            elif action == "demote":
                new_level = levels[max(curr_idx - 1, 0)]
                reasoning = f"Laya Decision: Lowered difficulty for reinforcement ({student_score*100:.0f}% accuracy). Readiness: {readiness}."
            else:
                new_level = levels[curr_idx]
                reasoning = f"Laya Decision: Maintained optimal learning difficulty. Readiness: {readiness}."

            return json.dumps({
                "difficulty": new_level,
                "confidence": round(float(conf), 2),
                "reasoning": reasoning,
                "readiness": readiness,
                "engine": "Laya System 1 (ModernBERT)"
            })
        except Exception as err:
            print("Laya prediction error:", err)

    # Fallback heuristic
    if student_score > 0.8 and streak >= 2:
        new_level = levels[min(curr_idx + 1, 2)]
        reasoning = f"Rule-based: High accuracy ({student_score*100:.0f}%) with streak of {streak}."
    elif student_score < 0.45:
        new_level = levels[max(curr_idx - 1, 0)]
        reasoning = f"Rule-based: Accuracy ({student_score*100:.0f}%) needs reinforcement."
    else:
        new_level = levels[curr_idx]
        reasoning = f"Rule-based: Steady progress at {student_score*100:.0f}%."

    return json.dumps({
        "difficulty": new_level,
        "confidence": 0.85,
        "reasoning": reasoning,
        "readiness": "Developing",
        "engine": "Algorithmic Heuristic"
    })


@spaces.GPU
def evaluate_student_readiness(student_answer: str, correct_answer: str, topic: str):
    """
    Uses Laya to evaluate conceptual gap when student makes a mistake.
    """
    if laya_router is not None:
        try:
            state = f"Topic: {topic}. Expected answer: '{correct_answer}'. Student selected: '{student_answer}'."
            questions = {
                "misconception_type": {
                    "type": "choice",
                    "instructions": "Classify the type of error the student made.",
                    "criteria": {
                        "careless": "Student made a calculation or reading slip on basic detail.",
                        "conceptual": "Student lacks fundamental understanding of the concept.",
                        "unfamiliar": "Student has never seen this subtopic before."
                    }
                }
            }
            res = laya_router.predict(state, questions)
            return json.dumps(res)
        except Exception as e:
            print("Laya eval error:", e)

    return json.dumps({"misconception_type": {"answer": "conceptual", "confidence": 0.7}})


# Gradio UI & API definitions
with gr.Blocks(title="Laya System 1 Decision Engine") as demo:
    gr.Markdown("# ⚡ Laya System 1 Decision Engine")
    gr.Markdown("Non-autoregressive, calibrated fast AI decisions for Adaptive Quiz Platform.")
    
    with gr.Tab("Adapt Difficulty API"):
        with gr.Row():
            in_score = gr.Number(label="Student Accuracy (0.0 - 1.0)", value=0.85)
            in_diff = gr.Dropdown(choices=["easy", "medium", "hard"], value="medium", label="Current Difficulty")
            in_streak = gr.Number(label="Streak", value=3)
            in_topic = gr.Textbox(label="Topic", value="Algebraic Equations")
            in_total = gr.Number(label="Total Questions", value=10)
        
        btn_adapt = gr.Button("Evaluate Decision with Laya", variant="primary")
        out_adapt = gr.JSON(label="Laya Decision Output")
        btn_adapt.click(
            fn=adapt_difficulty,
            inputs=[in_score, in_diff, in_streak, in_topic, in_total],
            outputs=out_adapt,
            api_name="adapt_difficulty"
        )

    with gr.Tab("Misconception Analysis API"):
        in_s_ans = gr.Textbox(label="Student Answer", value="4x")
        in_c_ans = gr.Textbox(label="Correct Answer", value="2x + 4")
        in_eval_topic = gr.Textbox(label="Topic", value="Calculus")
        btn_eval = gr.Button("Analyze Misconception", variant="secondary")
        out_eval = gr.JSON(label="Analysis Result")
        btn_eval.click(
            fn=evaluate_student_readiness,
            inputs=[in_s_ans, in_c_ans, in_eval_topic],
            outputs=out_eval,
            api_name="evaluate_misconception"
        )

demo.launch()
