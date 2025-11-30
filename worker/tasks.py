import os
import io
from urllib.parse import urlparse, parse_qs

import requests
from bs4 import BeautifulSoup
from celery_app import app
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from groq import Groq
import trafilatura
import youtube_transcript_api
from pypdf import PdfReader

load_dotenv()

# --- Database Setup ---
client = MongoClient(os.getenv('MONGO_URI'))
db = client['reading-list']
articles_collection = db['articles']

groq_client = Groq(
    api_key=os.getenv("GROQ_API_KEY"),
)

# --- Configuration ---
MAX_CHAR_LIMIT = 30000
MODEL_NAME = "llama-3.3-70b-versatile"


# =============== YOUTUBE HELPERS ===============

def get_video_id(url: str):
    """
    Detect YouTube video IDs from:
    - https://www.youtube.com/watch?v=ID
    - https://youtu.be/ID
    - https://www.youtube.com/embed/ID
    - https://www.youtube.com/v/ID
    - https://www.youtube.com/shorts/ID
    - m.youtube.com variants
    """
    parsed = urlparse(url)

    host = (parsed.hostname or "").lower()
    path = parsed.path or ""

    # short links
    if host in ("youtu.be", "www.youtu.be"):
        return path.lstrip("/")

    if "youtube.com" in host or "m.youtube.com" in host:
        # standard watch url
        if path == "/watch":
            qs = parse_qs(parsed.query)
            return qs.get("v", [None])[0]

        parts = path.strip("/").split("/")

        # /embed/ID, /v/ID, /shorts/ID
        if len(parts) >= 2 and parts[0] in ("embed", "v", "shorts"):
            return parts[1]

    return None


def get_youtube_transcript(video_id: str):
    """
    Try to fetch English transcript; if not available,
    use first transcript and translate to English.
    """
    try:
        transcript_list = youtube_transcript_api.YouTubeTranscriptApi.list_transcripts(video_id)

        # Prefer English transcripts
        try:
            transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB'])
        except Exception:
            # fallback: first transcript, translated to English if possible
            transcript = list(transcript_list)[0]
            try:
                transcript = transcript.translate('en')
            except Exception:
                pass

        data = transcript.fetch()
        text = " ".join([t.get('text', '') for t in data])
        return text.strip() or None

    except Exception as e:
        print(f"Transcript Error: {str(e)}")
        return None


def get_youtube_title_and_description(url: str):
    """
    If transcript isn't usable, we fall back to the video
    title + description (from meta tags), which is much more
    relevant than the side/footer links.
    """
    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        ),
        'Accept-Language': 'en-US,en;q=0.9',
    }

    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    html = resp.text
    soup = BeautifulSoup(html, 'html.parser')

    # Title
    title = "YouTube Video"
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif soup.title and soup.title.string:
        title = soup.title.string.replace("- YouTube", "").strip()

    # Description
    description = ""
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        description = og_desc["content"].strip()
    else:
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            description = meta_desc["content"].strip()

    combined = f"{title}\n\n{description}".strip()
    return title, combined


# =============== PDF HELPER ===============

def extract_from_pdf(url: str) -> str:
    print("Prepping PDF extraction...")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    with io.BytesIO(response.content) as f:
        reader = PdfReader(f)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text() or ""
            text += page_text + "\n"
    return text


# =============== MAIN TASK ===============

@app.task(name='tasks.process_article')
def process_article(article_id, url):
    print(f"🚀 Processing: {url}")

    title = "Untitled Content"
    text_content = ""

    try:
        # --- 1. CHECK IF YOUTUBE VIDEO ---
        video_id = get_video_id(url)
        if video_id:
            print(f"🎥 Detected YouTube Video ID: {video_id}")

            # First choice: transcript (actual spoken content)
            transcript_text = get_youtube_transcript(video_id)

            # Second choice: video description/meta
            yt_title, meta_text = get_youtube_title_and_description(url)

            if transcript_text and len(transcript_text) > 50:
                print("✅ Using video transcript for summary.")
                text_content = transcript_text
                title = yt_title
            elif meta_text and len(meta_text) > 30:
                print("⚠️ No transcript, using video description/meta.")
                text_content = meta_text
                title = yt_title
            else:
                raise Exception("Could not get enough content from YouTube video.")

        # --- 2. CHECK IF PDF ---
        elif url.lower().endswith('.pdf'):
            print("📄 Detected PDF Document")
            text_content = extract_from_pdf(url)
            title = url.split('/')[-1].replace('.pdf', '').replace('%20', ' ')

        # --- 3. STANDARD WEB SCRAPING ---
        else:
            headers = {
                'User-Agent': (
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/120.0.0.0 Safari/537.36'
                ),
                'Accept-Language': 'en-US,en;q=0.9',
            }
            try:
                downloaded = trafilatura.fetch_url(url)
                if downloaded is None:
                    resp = requests.get(url, headers=headers, timeout=15)
                    resp.raise_for_status()
                    downloaded = resp.text

                text_content = trafilatura.extract(
                    downloaded,
                    include_comments=False,
                    include_tables=False
                )
                soup_meta = BeautifulSoup(downloaded, 'html.parser')
                title = soup_meta.title.string.strip() if soup_meta.title else "Web Article"

                # Fallback if trafilatura fails
                if not text_content:
                    for bad in soup_meta(["script", "style", "nav", "footer", "aside"]):
                        bad.decompose()
                    text_content = soup_meta.get_text(separator=' ', strip=True)

            except Exception as req_err:
                raise Exception(f"Network error: {str(req_err)}")

        # --- VALIDATION ---
        if not text_content or len(text_content) < 50:
            raise Exception("Content appears empty.")
        if len(text_content) > MAX_CHAR_LIMIT:
            text_content = text_content[:MAX_CHAR_LIMIT] + "... [Truncated]"

        # --- CALL AI (SUMMARY) ---
        print("🧠 Sending to AI...")
        summary_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a concise summarizer. Do NOT return a wall of text. "
                        "Follow this strict format:\n\n"
                        "1. 🎯 **TL;DR**: One clear sentence.\n"
                        "2. 🔑 **Key Points**: Use a bulleted list (max 5 points). "
                        "Use simple bullets like '•' or '➤'.\n"
                        "3. 💡 **Conclusion**: A brief wrap-up sentence.\n\n"
                        "Keep the total length under 200 words."
                    ),
                },
                {
                    "role": "user",
                    "content": text_content
                }
            ],
            model=MODEL_NAME,
            temperature=0.4,
        )
        summary_text = summary_completion.choices[0].message.content

        # --- CALL AI (TOPIC CLASSIFICATION) ---
        topic_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify this content into exactly 2 topics "
                        "(e.g. Tech, Finance, AI, Education). "
                        "Return ONLY 'Topic1, Topic2'."
                    ),
                },
                {
                    "role": "user",
                    "content": text_content
                }
            ],
            model=MODEL_NAME,
            temperature=0.2,
        )

        raw_topics = topic_completion.choices[0].message.content
        topics = [t.strip().replace('.', '') for t in raw_topics.split(',') if t.strip()]

        # --- SAVE TO DB ---
        articles_collection.update_one(
            {'_id': ObjectId(article_id)},
            {'$set': {
                'title': title,
                'summary': summary_text,
                'topics': topics,
                'status': 'completed'
            }}
        )
        print(f"✅ Finished processing: {title}")

    except Exception as e:
        print(f"❌ Error processing {url}: {e}")
        articles_collection.update_one(
            {'_id': ObjectId(article_id)},
            {'$set': {'status': 'failed', 'summary': f"Error: {str(e)}"}}
        )
