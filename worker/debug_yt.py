from youtube_transcript_api import YouTubeTranscriptApi

print("✅ Library imported successfully.")
try:
    # Test with a known video (NASA)
    transcript = YouTubeTranscriptApi.get_transcript("TBL74Wsfbig", languages=['en'])
    print("✅ Transcript fetched!")
    print(transcript[0])
except Exception as e:
    print(f"❌ Error: {e}")
    print(f"DEBUG: Available methods: {dir(YouTubeTranscriptApi)}")