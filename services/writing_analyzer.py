"""
Fluent X Writing Analyzer
=========================
Handles AI-powered analysis of essays and written work.

Analyzes content, grammar, vocabulary, organization, coherence,
sentence structure, and relevance to the prompt.
"""

from services.ai_service import (
    get_config, is_ai_available, not_configured_response,
    error_response, success_response,
    send_ai_request, parse_json_from_ai_response,
)


WRITING_ANALYSIS_PROMPT = """You are an expert English writing tutor analyzing a student's essay.

Writing type: {writing_type}
Prompt: {prompt}
Word count: {word_count}

Here is the student's essay:
---
{content}
---

Analyze this essay and return ONLY a valid JSON object (no markdown, no explanation outside the JSON) with these fields:

{{
  "overall_score": <integer 1-10>,
  "grammar_score": <integer 1-10>,
  "vocabulary_score": <integer 1-10>,
  "organization_score": <integer 1-10>,
  "coherence_score": <integer 1-10>,
  "task_score": <integer 1-10, how well the essay addresses the prompt>,
  "sentence_structure_score": <integer 1-10>,
  "strengths": [<list of specific strengths in the essay>],
  "weaknesses": [<list of specific weaknesses in the essay>],
  "corrections": [
    {{
      "original": "<the incorrect sentence or phrase>",
      "corrected": "<the corrected version>",
      "explanation": "<brief explanation of the error>"
    }}
  ],
  "better_word_choices": [
    {{
      "original": "<the word/phrase used>",
      "suggested": "<a better alternative>",
      "reason": "<why the suggestion is better>"
    }}
  ],
  "weak_sentences": [
    {{
      "sentence": "<the weak sentence>",
      "issue": "<what's wrong with it>",
      "improved": "<an improved version>"
    }}
  ],
  "repeated_words": [<list of words used excessively throughout the essay>],
  "transition_suggestions": [
    {{
      "context": "<where a transition is needed>",
      "suggestion": "<suggested transition phrase>"
    }}
  ],
  "introduction_feedback": "<specific feedback on the introduction paragraph>",
  "body_feedback": "<specific feedback on the body paragraphs>",
  "conclusion_feedback": "<specific feedback on the conclusion>",
  "recommendations": [<list of specific practice recommendations>],
  "summary": "<2-3 sentence overall assessment>"
}}

Scoring guide:
- 1-3: Significant issues, needs major improvement
- 4-5: Below average, noticeable problems
- 6-7: Good, some areas for improvement
- 8-9: Very good, minor issues only
- 10: Excellent, near-native

Be specific and constructive. Reference actual sentences from the essay.
Focus on actionable feedback that helps the student improve.
If the prompt is not provided (empty), set task_score to null.
"""


def analyze_writing(content, writing_type='', prompt='', context=None):
    """
    Analyze an essay using AI.

    Args:
        content: The essay text
        writing_type: Type of writing (Argumentative, Narrative, etc.)
        prompt: The original writing prompt
        context: Optional dict with additional metadata

    Returns:
        dict with analysis results or error/not-configured state
    """
    if not is_ai_available():
        return not_configured_response('writing')

    if not content or not content.strip():
        return error_response(
            'No essay content available for analysis.',
            analysis_type='writing'
        )

    word_count = len(content.split()) if content else 0
    if word_count < 20:
        return error_response(
            'Essay is too short for meaningful analysis. Please write at least 20 words.',
            analysis_type='writing'
        )

    prompt_text = WRITING_ANALYSIS_PROMPT.format(
        writing_type=writing_type or 'General',
        prompt=prompt or 'No specific prompt provided',
        word_count=word_count,
        content=content.strip(),
    )

    messages = [
        {'role': 'system', 'content': 'You are an expert English writing assessment tutor. Always respond with valid JSON only.'},
        {'role': 'user', 'content': prompt_text},
    ]

    result = send_ai_request(messages, temperature=0.3, max_tokens=3000)

    if not result['success']:
        return error_response(
            result['error'] or 'AI analysis request failed.',
            analysis_type='writing'
        )

    # Parse JSON from AI response
    parsed = parse_json_from_ai_response(result['content'])
    if parsed is None:
        return error_response(
            'AI returned an invalid response format. Please try again.',
            analysis_type='writing'
        )

    # Validate and sanitize scores
    def clamp_score(val):
        if val is None:
            return None
        try:
            v = int(val)
            return max(1, min(10, v))
        except (TypeError, ValueError):
            return None

    analysis_data = {
        'overall_score': clamp_score(parsed.get('overall_score')),
        'grammar_score': clamp_score(parsed.get('grammar_score')),
        'vocabulary_score': clamp_score(parsed.get('vocabulary_score')),
        'organization_score': clamp_score(parsed.get('organization_score')),
        'coherence_score': clamp_score(parsed.get('coherence_score')),
        'task_score': clamp_score(parsed.get('task_score')),
        'sentence_structure_score': clamp_score(parsed.get('sentence_structure_score')),
        'strengths': parsed.get('strengths', []) if isinstance(parsed.get('strengths'), list) else [],
        'weaknesses': parsed.get('weaknesses', []) if isinstance(parsed.get('weaknesses'), list) else [],
        'corrections': parsed.get('corrections', []) if isinstance(parsed.get('corrections'), list) else [],
        'better_word_choices': parsed.get('better_word_choices', []) if isinstance(parsed.get('better_word_choices'), list) else [],
        'weak_sentences': parsed.get('weak_sentences', []) if isinstance(parsed.get('weak_sentences'), list) else [],
        'repeated_words': parsed.get('repeated_words', []) if isinstance(parsed.get('repeated_words'), list) else [],
        'transition_suggestions': parsed.get('transition_suggestions', []) if isinstance(parsed.get('transition_suggestions'), list) else [],
        'introduction_feedback': str(parsed.get('introduction_feedback', ''))[:500],
        'body_feedback': str(parsed.get('body_feedback', ''))[:500],
        'conclusion_feedback': str(parsed.get('conclusion_feedback', ''))[:500],
        'recommendations': parsed.get('recommendations', []) if isinstance(parsed.get('recommendations'), list) else [],
        'summary': str(parsed.get('summary', ''))[:1000],
    }

    return success_response(analysis_data, analysis_type='writing')


def extract_mistakes_from_writing(analysis_result, attempt_id=0):
    """
    Extract individual mistakes from a writing analysis result.
    Returns a list of mistake dicts suitable for the mistakes table.
    """
    if not analysis_result or not analysis_result.get('success'):
        return []

    mistakes = []

    # Corrections become grammar mistakes
    for correction in analysis_result.get('corrections', []):
        if not isinstance(correction, dict):
            continue
        original = correction.get('original', '').strip()
        corrected = correction.get('corrected', '').strip()
        explanation = correction.get('explanation', 'Grammar error').strip()
        if original and corrected:
            mistakes.append({
                'category': 'Grammar',
                'description': f'{explanation}. Corrected: "{corrected}"',
                'example': original,
                'source': 'writing',
                'source_attempt_id': attempt_id,
            })

    # Weak sentences become sentence structure mistakes
    for weak in analysis_result.get('weak_sentences', []):
        if not isinstance(weak, dict):
            continue
        sentence = weak.get('sentence', '').strip()
        issue = weak.get('issue', 'Weak sentence structure').strip()
        improved = weak.get('improved', '').strip()
        if sentence:
            desc = issue
            if improved:
                desc += f'. Suggested: "{improved}"'
            mistakes.append({
                'category': 'Sentence Structure',
                'description': desc,
                'example': sentence[:200],
                'source': 'writing',
                'source_attempt_id': attempt_id,
            })

    # Repeated words become vocabulary mistakes
    repeated = analysis_result.get('repeated_words', [])
    if isinstance(repeated, list):
        for word in repeated:
            if isinstance(word, str) and word.strip():
                mistakes.append({
                    'category': 'Vocabulary',
                    'description': f'Excessive repetition of word: "{word.strip()}"',
                    'example': word.strip(),
                    'source': 'writing',
                    'source_attempt_id': attempt_id,
                })

    # Better word choices become vocabulary mistakes
    for choice in analysis_result.get('better_word_choices', []):
        if not isinstance(choice, dict):
            continue
        original = choice.get('original', '').strip()
        suggested = choice.get('suggested', '').strip()
        if original and suggested:
            mistakes.append({
                'category': 'Vocabulary',
                'description': f'Consider "{suggested}" instead of "{original}"',
                'example': original,
                'source': 'writing',
                'source_attempt_id': attempt_id,
            })

    # Transition suggestions
    for suggestion in analysis_result.get('transition_suggestions', []):
        if not isinstance(suggestion, dict):
            continue
        context_text = suggestion.get('context', '').strip()
        suggestion_text = suggestion.get('suggestion', '').strip()
        if suggestion_text:
            mistakes.append({
                'category': 'Transitions',
                'description': f'Add transition: "{suggestion_text}"',
                'example': context_text[:200] if context_text else '',
                'source': 'writing',
                'source_attempt_id': attempt_id,
            })

    return mistakes
