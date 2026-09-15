"""
Fluent X Speaking Analyzer
==========================
Handles AI-powered analysis of speaking sessions.

Analyzes transcripts for grammar, vocabulary, fluency, clarity,
and sentence construction. Provides corrections and recommendations.

Pronunciation analysis requires audio/speech processing which is not
available through text-based AI. pronunciation_score is set to null.
"""

from services.ai_service import (
    get_config, is_ai_available, not_configured_response,
    error_response, success_response,
    send_ai_request, parse_json_from_ai_response,
)


SPEAKING_ANALYSIS_PROMPT = """You are an expert English speaking coach analyzing a student's spoken transcript.

The student was asked to speak on this topic: "{topic}"
Speaking category: {category}
Duration: {duration} seconds

Here is the student's transcript:
---
{transcript}
---

Analyze this speaking transcript and return ONLY a valid JSON object (no markdown, no explanation outside the JSON) with these fields:

{{
  "overall_score": <integer 1-10>,
  "grammar_score": <integer 1-10>,
  "vocabulary_score": <integer 1-10>,
  "fluency_score": <integer 1-10>,
  "clarity_score": <integer 1-10>,
  "pronunciation_score": null,
  "strengths": [<list of specific strengths found in the transcript>],
  "weaknesses": [<list of specific weaknesses found in the transcript>],
  "corrections": [
    {{
      "original": "<the incorrect phrase as spoken>",
      "corrected": "<the corrected version>",
      "explanation": "<brief explanation of the error>"
    }}
  ],
  "filler_words": [<list of filler words found, e.g. "um", "uh", "like", "you know">],
  "repeated_words": [<list of words used excessively>],
  "recommendations": [<list of specific practice recommendations>],
  "summary": "<2-3 sentence overall assessment>"
}}

Scoring guide:
- 1-3: Significant issues, needs major improvement
- 4-5: Below average, noticeable problems
- 6-7: Good, some areas for improvement
- 8-9: Very good, minor issues only
- 10: Excellent, near-native

Be specific and constructive. Reference actual phrases from the transcript.
For pronunciation_score, always set to null since audio analysis is not available.
"""


def analyze_speaking(transcript, topic='', category='', context=None):
    """
    Analyze a speaking transcript using AI.

    Args:
        transcript: The user's spoken text
        topic: The speaking topic
        category: The speaking category
        context: Optional dict with 'duration' and other metadata

    Returns:
        dict with analysis results or error/not-configured state
    """
    if not is_ai_available():
        return not_configured_response('speaking')

    if not transcript or not transcript.strip():
        return error_response(
            'No transcript available for analysis. '
            'Transcription must be completed before speaking analysis.',
            analysis_type='speaking'
        )

    duration = (context or {}).get('duration', 0)

    prompt = SPEAKING_ANALYSIS_PROMPT.format(
        topic=topic or 'General speaking',
        category=category or 'General',
        duration=duration,
        transcript=transcript.strip(),
    )

    messages = [
        {'role': 'system', 'content': 'You are an English language assessment expert. Always respond with valid JSON only.'},
        {'role': 'user', 'content': prompt},
    ]

    result = send_ai_request(messages, temperature=0.3, max_tokens=2048)

    if not result['success']:
        return error_response(
            result['error'] or 'AI analysis request failed.',
            analysis_type='speaking'
        )

    # Parse JSON from AI response
    parsed = parse_json_from_ai_response(result['content'])
    if parsed is None:
        return error_response(
            'AI returned an invalid response format. Please try again.',
            analysis_type='speaking'
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
        'fluency_score': clamp_score(parsed.get('fluency_score')),
        'clarity_score': clamp_score(parsed.get('clarity_score')),
        'pronunciation_score': None,  # Not available without audio processing
        'strengths': parsed.get('strengths', []) if isinstance(parsed.get('strengths'), list) else [],
        'weaknesses': parsed.get('weaknesses', []) if isinstance(parsed.get('weaknesses'), list) else [],
        'corrections': parsed.get('corrections', []) if isinstance(parsed.get('corrections'), list) else [],
        'filler_words': parsed.get('filler_words', []) if isinstance(parsed.get('filler_words'), list) else [],
        'repeated_words': parsed.get('repeated_words', []) if isinstance(parsed.get('repeated_words'), list) else [],
        'recommendations': parsed.get('recommendations', []) if isinstance(parsed.get('recommendations'), list) else [],
        'summary': str(parsed.get('summary', ''))[:1000],
    }

    return success_response(analysis_data, analysis_type='speaking')


def extract_mistakes_from_speaking(analysis_result, attempt_id=0):
    """
    Extract individual mistakes from a speaking analysis result.
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
                'source': 'speaking',
                'source_attempt_id': attempt_id,
            })

    # Filler words become fluency mistakes
    filler_words = analysis_result.get('filler_words', [])
    if isinstance(filler_words, list) and filler_words:
        unique_fillers = list(set(filler_words))
        for filler in unique_fillers:
            count = filler_words.count(filler)
            if count >= 2:  # Only track if used multiple times
                mistakes.append({
                    'category': 'Fluency',
                    'description': f'Frequent use of filler word: "{filler}" ({count} times)',
                    'example': filler,
                    'source': 'speaking',
                    'source_attempt_id': attempt_id,
                })

    # Repeated words become fluency mistakes
    repeated = analysis_result.get('repeated_words', [])
    if isinstance(repeated, list):
        for word in repeated:
            if isinstance(word, str) and word.strip():
                mistakes.append({
                    'category': 'Fluency',
                    'description': f'Excessive repetition of word: "{word.strip()}"',
                    'example': word.strip(),
                    'source': 'speaking',
                    'source_attempt_id': attempt_id,
                })

    return mistakes
