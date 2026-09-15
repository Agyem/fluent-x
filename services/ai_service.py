"""
Fluent X AI Service
===================
Central orchestrator for AI-powered analysis.

Reads configuration from environment variables and provides a unified
interface for sending requests to OpenAI-compatible AI providers.

When no AI provider is configured, all analysis functions return a clear
"not configured" state. NO fake scores are ever generated.
"""

import os
import json
import time
import logging
from datetime import datetime

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

class AIConfig:
    """Reads AI configuration from environment variables."""

    def __init__(self):
        self.provider = os.environ.get('AI_PROVIDER', '').strip()
        self.api_key = os.environ.get('AI_API_KEY', '').strip()
        self.model = os.environ.get('AI_MODEL', '').strip()
        self.api_base = os.environ.get('AI_API_BASE', '').strip().rstrip('/')

    @property
    def is_configured(self):
        """Returns True only if a real provider and API key are set."""
        return bool(self.provider and self.api_key)

    @property
    def base_url(self):
        """Return the API base URL for the configured provider."""
        if self.api_base:
            return self.api_base
        providers = {
            'openai': 'https://api.openai.com/v1',
            'anthropic': 'https://api.anthropic.com/v1',
            'google': 'https://generativelanguage.googleapis.com/v1beta',
        }
        return providers.get(self.provider, 'https://api.openai.com/v1')

    def to_dict(self):
        """Safe representation (never exposes the API key)."""
        return {
            'provider': self.provider or None,
            'model': self.model or None,
            'configured': self.is_configured,
        }


# Singleton
_config = None


def get_config():
    global _config
    if _config is None:
        _config = AIConfig()
    return _config


def is_ai_available():
    return get_config().is_configured


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def not_configured_response(analysis_type='general'):
    return {
        'success': False,
        'configured': False,
        'analysis_type': analysis_type,
        'message': 'AI analysis is not configured yet.',
        'detail': (
            'AI-powered analysis requires an AI provider to be configured. '
            'Please set AI_PROVIDER and AI_API_KEY in your .env file. '
            'See .env.example for available options.'
        ),
        'analyzed_at': None,
    }


def error_response(message, analysis_type='general'):
    return {
        'success': False,
        'configured': is_ai_available(),
        'analysis_type': analysis_type,
        'message': message,
        'analyzed_at': datetime.now().isoformat(timespec='seconds'),
    }


def success_response(data, analysis_type='general'):
    return {
        'success': True,
        'configured': True,
        'analysis_type': analysis_type,
        'message': 'Analysis completed successfully.',
        'analyzed_at': datetime.now().isoformat(timespec='seconds'),
        **data,
    }


# ---------------------------------------------------------------------------
# JSON serialization helpers
# ---------------------------------------------------------------------------

def parse_analysis_json(raw):
    if not raw:
        return {}
    try:
        if isinstance(raw, str):
            return json.loads(raw)
        return raw
    except (json.JSONDecodeError, TypeError):
        return {}


def serialize_analysis_json(data):
    if data is None:
        return None
    try:
        return json.dumps(data, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# AI request sending (OpenAI-compatible API)
# ---------------------------------------------------------------------------

REQUEST_TIMEOUT = 60  # seconds


def send_ai_request(messages, temperature=0.3, max_tokens=4096):
    """
    Send a chat completion request to the configured AI provider.

    Uses the OpenAI-compatible chat/completions endpoint.
    Works with OpenAI, and many other providers that support this format.

    Args:
        messages: list of dicts with 'role' and 'content' keys
        temperature: sampling temperature (lower = more deterministic)
        max_tokens: maximum tokens in response

    Returns:
        dict with keys:
            success (bool)
            content (str | None): the AI's response text
            error (str | None): error message if failed
            raw (dict | None): the full API response
    """
    config = get_config()

    if not config.is_configured:
        return {
            'success': False,
            'content': None,
            'error': 'AI provider is not configured.',
            'raw': None,
        }

    headers = {
        'Content-Type': 'application/json',
    }

    # Provider-specific header handling
    if config.provider == 'anthropic':
        headers['x-api-key'] = config.api_key
        headers['anthropic-version'] = '2023-06-01'
    elif config.provider == 'openai':
        headers['Authorization'] = f'Bearer {config.api_key}'
    else:
        # Generic: try Bearer token
        headers['Authorization'] = f'Bearer {config.api_key}'

    # Build request body
    # Anthropic uses a slightly different format
    if config.provider == 'anthropic':
        # Extract system message for Anthropic format
        system_text = ''
        user_messages = []
        for msg in messages:
            if msg['role'] == 'system':
                system_text += msg['content'] + '\n'
            else:
                user_messages.append(msg)

        body = {
            'model': config.model or 'claude-sonnet-4-20250514',
            'max_tokens': max_tokens,
            'temperature': temperature,
            'messages': user_messages,
        }
        if system_text.strip():
            body['system'] = system_text.strip()
    else:
        # OpenAI-compatible format
        body = {
            'model': config.model or 'gpt-4o',
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
        }

    url = f'{config.base_url}/chat/completions'

    try:
        resp = requests.post(
            url,
            headers=headers,
            json=body,
            timeout=REQUEST_TIMEOUT,
        )

        if resp.status_code != 200:
            error_detail = ''
            try:
                err_json = resp.json()
                error_detail = err_json.get('error', {}).get('message', resp.text[:500])
            except Exception:
                error_detail = resp.text[:500]
            logger.warning('AI API returned status %d: %s', resp.status_code, error_detail)
            return {
                'success': False,
                'content': None,
                'error': f'AI provider returned status {resp.status_code}: {error_detail}',
                'raw': None,
            }

        data = resp.json()

        # Extract content from response
        content = None
        if config.provider == 'anthropic':
            # Anthropic response format
            content_blocks = data.get('content', [])
            if isinstance(content_blocks, list) and content_blocks:
                content = content_blocks[0].get('text', '')
        else:
            # OpenAI-compatible format
            choices = data.get('choices', [])
            if isinstance(choices, list) and choices:
                content = choices[0].get('message', {}).get('content', '')

        if not content:
            return {
                'success': False,
                'content': None,
                'error': 'AI provider returned an empty response.',
                'raw': data,
            }

        return {
            'success': True,
            'content': content,
            'error': None,
            'raw': data,
        }

    except requests.exceptions.Timeout:
        logger.warning('AI request timed out after %ds', REQUEST_TIMEOUT)
        return {
            'success': False,
            'content': None,
            'error': f'AI request timed out after {REQUEST_TIMEOUT} seconds.',
            'raw': None,
        }
    except requests.exceptions.ConnectionError as e:
        logger.warning('AI connection error: %s', str(e)[:200])
        return {
            'success': False,
            'content': None,
            'error': 'Could not connect to AI provider. Please check your network and provider configuration.',
            'raw': None,
        }
    except requests.exceptions.RequestException as e:
        logger.warning('AI request failed: %s', str(e)[:200])
        return {
            'success': False,
            'content': None,
            'error': f'AI request failed: {str(e)[:200]}',
            'raw': None,
        }
    except Exception as e:
        logger.error('Unexpected error in AI request: %s', str(e)[:200])
        return {
            'success': False,
            'content': None,
            'error': f'Unexpected error during AI analysis: {str(e)[:200]}',
            'raw': None,
        }


def parse_json_from_ai_response(text):
    """
    Attempt to extract a JSON object from an AI response string.
    Handles cases where the AI wraps JSON in markdown code blocks.
    """
    if not text:
        return None

    # Try direct parse first
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass

    # Try extracting from markdown code block
    import re
    patterns = [
        r'```json\s*\n(.*?)\n\s*```',
        r'```\s*\n(.*?)\n\s*```',
        r'\{.*\}',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            candidate = match.group(1) if match.lastindex else match.group(0)
            try:
                return json.loads(candidate)
            except (json.JSONDecodeError, TypeError):
                continue

    return None
