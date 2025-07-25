import time
import random

# --- Configuration ---
TARGET_FILE = "lorem_output_random.txt" # The file to "type" into
DURATION_SECONDS = 72000                  # 2 hours = 7200 seconds
TOTAL_WORDS = 500000                       # Approximately how many words to "type" in total

# Random delay range between "typing" chunks
MIN_DELAY_SECONDS = 10
MAX_DELAY_SECONDS = 30

# Average words per "paragraph" before a newline
WORDS_PER_PARAGRAPH_AVG = 50
PARAGRAPH_VARIANCE = 20 # Allows paragraphs to be between 30 and 70 words (50 +/- 20)

# --- Install lorem_text if not present ---
# You'll need to run 'pip install lorem_text' in your Codespace terminal first.
try:
    from lorem_text import lorem
    def lorem_text(word_count):
        return lorem.words(word_count).capitalize() + "."
except ImportError:
    print("The 'lorem_text' library is not found.")
    print("Please install it by running 'pip install lorem_text' in your Codespace terminal.")
    # Fallback to basic generator if lorem_text isn't installed
    def lorem_text(word_count):
        words = [
            "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
            "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
            "magna", "aliqua", "ut", "enim", "ad", "minim", "veniam", "quis", "nostrud",
            "exercitation", "ullamco", "laboris", "nisi", "ut", "aliquip", "ex", "ea",
            "commodo", "consequat", "duis", "aute", "irure", "dolor", "in", "reprehenderit",
            "in", "voluptate", "velit", "esse", "cillum", "dolore", "eu", "fugiat", "nulla",
            "pariatur", "excepteur", "sint", "occaecat", "cupidatat", "non", "proident",
            "sunt", "in", "culpa", "qui", "officia", "deserunt", "mollit", "anim", "id",
            "est", "laborum"
        ]
        return ' '.join(random.choice(words) for _ in range(word_count)).capitalize() + "."
    print("Using a basic Lorem Ipsum generator as a fallback.")

# --- Main Script ---
def run_autotyper():
    print(f"Starting Lorem Ipsum 'autotyper' for {DURATION_SECONDS // 60} minutes.")
    print(f"Target file: {TARGET_FILE}")
    print(f"Total words: {TOTAL_WORDS}")
    print(f"Random delay between chunks: {MIN_DELAY_SECONDS}-{MAX_DELAY_SECONDS} seconds.")

    # Generate all the Lorem Ipsum text upfront
    # We'll break it into "chunks" that roughly correspond to paragraphs
    all_chunks = []
    words_generated = 0
    while words_generated < TOTAL_WORDS:
        paragraph_word_count = random.randint(
            max(1, WORDS_PER_PARAGRAPH_AVG - PARAGRAPH_VARIANCE), # Ensure at least 1 word
            WORDS_PER_PARAGRAPH_AVG + PARAGRAPH_VARIANCE
        )
        if words_generated + paragraph_word_count > TOTAL_WORDS:
            paragraph_word_count = TOTAL_WORDS - words_generated

        if paragraph_word_count > 0:
            all_chunks.append(lorem_text(paragraph_word_count))
            words_generated += paragraph_word_count
        else:
            break # No more words to generate

    if not all_chunks:
        print("No text to type. Exiting.")
        return

    # Calculate the total characters to determine rough progress
    total_chars = sum(len(chunk) for chunk in all_chunks) + len(all_chunks) * 2 # +2 for each newline

    print(f"Generated {len(all_chunks)} text chunks (approx. {total_chars} chars).")
    print("Writing to file. This will take an hour...")

    start_time = time.time()
    try:
        # Open in append mode so we don't overwrite if the script restarts
        with open(TARGET_FILE, 'a', encoding='utf-8') as f:
            for i, chunk in enumerate(all_chunks):
                f.write(chunk)
                f.write("\n\n") # Add two newlines for a paragraph break
                f.flush() # Ensure the text is written to disk immediately

                # Calculate progress
                current_chars_written = sum(len(c) for c in all_chunks[:i+1]) + (i+1) * 2
                progress_percent = (current_chars_written / total_chars) * 100
                elapsed = time.time() - start_time

                print(f"Progress: {progress_percent:.2f}% | Chunks: {i+1}/{len(all_chunks)} | Elapsed: {elapsed:.1f}s")

                # If this isn't the last chunk, introduce a random delay
                if i < len(all_chunks) - 1:
                    delay = random.uniform(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS)
                    print(f"Waiting for {delay:.2f} seconds...")
                    time.sleep(delay)
                else:
                    print("Last chunk written, no final delay.")

        print("\n'Autotyper' finished!")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
    finally:
        end_time = time.time()
        print(f"Script finished in: {(end_time - start_time):.2f} seconds.")

if __name__ == "__main__":
    run_autotyper()