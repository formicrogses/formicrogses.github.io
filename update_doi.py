#!/usr/bin/env python3
import pandas as pd
import json
import re

# Read DOI Excel file
df = pd.read_excel('DOI.xlsx')

# Create DOI data dictionary with title as key
doi_data = {}
for _, row in df.iterrows():
    title = str(row['标题']).strip() if pd.notna(row['标题']) else ""
    if title:
        # Clean up the title - remove special characters for better matching
        clean_title = re.sub(r'[^\w\s]', '', title.lower()).strip()
        
        doi_data[clean_title] = {
            'doi': f"https://doi.org/{row['DOI号']}" if pd.notna(row['DOI号']) else "",
            'authors': str(row['作者']).strip() if pd.notna(row['作者']) else "",
            'journal': str(row['期刊名/会议名']).strip() if pd.notna(row['期刊名/会议名']) else "",
            'year': str(row['年份']).strip() if pd.notna(row['年份']) else "",
            'original_title': title
        }

# Read the current papers data
with open('papers-data-new.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the JSON part from the JavaScript file
start = content.find('const PAPERS_DATA = ') + len('const PAPERS_DATA = ')
# Find the closing of the PAPERS_DATA object
bracket_count = 0
json_end = start
for i in range(start, len(content)):
    if content[i] == '{':
        bracket_count += 1
    elif content[i] == '}':
        bracket_count -= 1
        if bracket_count == 0:
            json_end = i + 1
            break

json_str = content[start:json_end]
papers_data = json.loads(json_str)

# Match and update papers
matched_count = 0
unmatched_papers = []
unmatched_dois = []

for paper in papers_data['papers']:
    paper_title = paper.get('title', '').strip()
    clean_paper_title = re.sub(r'[^\w\s]', '', paper_title.lower()).strip()
    
    matched = False
    # Try exact match first
    if clean_paper_title in doi_data:
        doi_info = doi_data[clean_paper_title]
        if doi_info['doi']:
            paper['doi'] = doi_info['doi']
        if doi_info['authors']:
            paper['authors'] = doi_info['authors']
        if doi_info['journal']:
            paper['journal'] = doi_info['journal']
        matched_count += 1
        matched = True
        doi_data[clean_paper_title]['matched'] = True
    else:
        # Try partial match
        for doi_key, doi_info in doi_data.items():
            # Check if one title contains the other (at least 80% of words match)
            paper_words = set(clean_paper_title.split())
            doi_words = set(doi_key.split())
            
            if paper_words and doi_words:
                common_words = paper_words.intersection(doi_words)
                similarity = len(common_words) / min(len(paper_words), len(doi_words))
                
                if similarity > 0.8:
                    if doi_info['doi']:
                        paper['doi'] = doi_info['doi']
                    if doi_info['authors']:
                        paper['authors'] = doi_info['authors']
                    if doi_info['journal']:
                        paper['journal'] = doi_info['journal']
                    matched_count += 1
                    matched = True
                    doi_info['matched'] = True
                    break
    
    if not matched:
        unmatched_papers.append(paper_title)

# Find unmatched DOI entries
for doi_key, doi_info in doi_data.items():
    if not doi_info.get('matched', False) and doi_info['doi']:
        unmatched_dois.append(doi_info['original_title'])

# Generate the updated JavaScript file
header = """// Auto-generated papers data file V3 with DOI information
// Generated from Papers folder images and DOI.xlsx
// Generation time: """ + pd.Timestamp.now().isoformat() + "\n\n"

js_content = header + "const PAPERS_DATA = " + json.dumps(papers_data, indent=2, ensure_ascii=False) + ";"

# Write the updated file
with open('papers-data-new.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

# Print summary
print(f"Update complete!")
print(f"Total papers: {len(papers_data['papers'])}")
print(f"Papers matched with DOI data: {matched_count}")
print(f"Papers without DOI match: {len(unmatched_papers)}")
print(f"DOI entries without paper match: {len(unmatched_dois)}")

if unmatched_papers and len(unmatched_papers) <= 10:
    print("\nUnmatched papers (first 10):")
    for title in unmatched_papers[:10]:
        print(f"  - {title}")

if unmatched_dois and len(unmatched_dois) <= 10:
    print("\nUnmatched DOI entries (first 10):")
    for title in unmatched_dois[:10]:
        print(f"  - {title}")
