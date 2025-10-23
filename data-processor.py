#!/usr/bin/env python3
"""
数据处理脚本V3：只处理Papers文件夹中的图片
"""

import os
import json
import csv
import re
from pathlib import Path
from collections import defaultdict

def extract_info_from_filename(filename):
    """从文件名提取论文信息"""
    base_name = filename.replace('.png', '').replace('.jpg', '').replace('.jpeg', '')
    
    # 提取年份
    year_match = re.search(r'(\d{4})', base_name)
    year = year_match.group(1) if year_match else '2020'
    
    # 提取标题
    title = re.sub(r'^\d{4}\s*[-_]\s*', '', base_name)
    title = re.sub(r'^\d{4}\s+', '', title)
    title = title.strip()
    
    return {
        'year': year,
        'title': title
    }

def parse_tags(tag_string):
    """解析标签字符串"""
    if not tag_string:
        return []
    tags = re.findall(r'#(\w+)', tag_string)
    return tags

def process_csv_data():
    """处理CSV数据文件"""
    papers_data = []
    csv_folder = Path('/Users/lichuanpeng/Desktop/网站/2025 10 19 2913847b4e95807192e1cd0f9cf22daf 2')
    
    csv_files = [
        'Tags_1 (1) 2913847b4e9580a8ac26e6a19da235cf.csv',
        'Tags_2 (1) 2913847b4e9580698bd6dcb6fc5e1713.csv',
        'Tags_3 (1) 2913847b4e95800093f7ddaccf9bc3c8.csv'
    ]
    
    for csv_file in csv_files:
        csv_path = csv_folder / csv_file
        if csv_path.exists():
            print(f"处理CSV文件: {csv_file}")
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # 规范化Overview字段作为分类
                    overview = row.get('Overview', '').strip()
                    if overview == 'InteractionSoftware':
                        category = 'software'
                    elif overview == 'Gesture Design':
                        category = 'gesture-design'
                    elif overview == 'Hardware':
                        category = 'hardware'
                    elif overview == 'Software':
                        category = 'software'
                    else:
                        # 默认分类
                        category = 'hardware'
                    
                    paper = {
                        'id': len(papers_data) + 1,
                        'title': row.get('Title', ''),
                        'year': row.get('Year', ''),
                        'category': category,
                        'hardwareDevices': parse_tags(row.get('Hardware Devices', '')),
                        'sensingTechnology': parse_tags(row.get('Sensing Technology', '')),
                        'recognitionClassification': parse_tags(row.get('Recognition & Classification', '')),
                        'interactionModalities': parse_tags(row.get('Interaction Modalities', '')),
                        'gestureTypes': parse_tags(row.get('Gesture Types', '')),
                        'applicationScenarios': parse_tags(row.get('Application Scenarios', '')),
                        'feedbackOutput': parse_tags(row.get('Feedback & Output', '')),
                        'userExperienceDesign': parse_tags(row.get('User Experience & Design Factors', '')),
                        'image': None  # 稍后匹配
                    }
                    papers_data.append(paper)
    
    return papers_data

def scan_papers_folders():
    """只扫描Papers文件夹中的图片"""
    base_path = Path('/Users/lichuanpeng/Desktop/网站')
    image_data = defaultdict(list)
    
    # 只扫描Papers文件夹下的分类
    folders_to_scan = [
        ('Papers/HARDWARE/Hardware预览图', 'hardware'),
        ('Papers/SOFTWARE/Software预览图', 'software'),
        ('Papers/GestureDesign/GestureDesign预览图', 'gesture-design')
    ]
    
    # 扫描各个分类文件夹
    for folder_path, category in folders_to_scan:
        full_path = base_path / folder_path
        if full_path.exists():
            print(f"扫描文件夹: {folder_path}")
            image_count = 0
            for img_file in full_path.glob('*.png'):
                info = extract_info_from_filename(img_file.name)
                image_data[category].append({
                    'filename': img_file.name,
                    'path': str(folder_path + '/' + img_file.name),
                    'title': info['title'],
                    'year': info['year'],
                    'category': category
                })
                image_count += 1
            print(f"  找到 {image_count} 张图片")
    
    return image_data

def match_papers_with_images(papers_data, image_data):
    """匹配CSV数据和Papers文件夹中的图片"""
    # 收集所有Papers文件夹的图片
    all_images = []
    for category, images in image_data.items():
        all_images.extend(images)
    
    # 为CSV论文匹配图片
    matched_count = 0
    for paper in papers_data:
        paper_title_lower = paper['title'].lower()
        
        best_match = None
        best_score = 0
        
        for img in all_images:
            img_title_lower = img['title'].lower()
            
            # 精确匹配
            if paper_title_lower == img_title_lower:
                best_match = img
                break
            # 包含关系匹配
            elif paper_title_lower in img_title_lower or img_title_lower in paper_title_lower:
                # 计算匹配得分
                score = len(set(paper_title_lower.split()) & set(img_title_lower.split()))
                if score > best_score:
                    best_score = score
                    best_match = img
        
        if best_match:
            paper['image'] = best_match['path']
            matched_count += 1
    
    print(f"  CSV数据中 {matched_count}/{len(papers_data)} 条记录匹配到图片")
    return papers_data

def create_standalone_image_entries(image_data, papers_data):
    """为Papers文件夹中没有CSV数据的图片创建独立条目"""
    # 获取已经匹配的图片路径
    matched_images = set(p['image'] for p in papers_data if p.get('image'))
    
    standalone_papers = []
    paper_id = len(papers_data) + 1
    
    # 处理Papers文件夹中未匹配的图片
    for category, images in image_data.items():
        for img in images:
            if img['path'] not in matched_images:
                standalone_papers.append({
                    'id': paper_id,
                    'title': img['title'],
                    'year': img['year'],
                    'category': category,
                    'image': img['path'],
                    'hardwareDevices': [],
                    'sensingTechnology': [],
                    'recognitionClassification': [],
                    'interactionModalities': [],
                    'gestureTypes': [],
                    'applicationScenarios': [],
                    'feedbackOutput': [],
                    'userExperienceDesign': []
                })
                paper_id += 1
    
    return standalone_papers

def generate_javascript_file(all_papers):
    """生成JavaScript数据文件"""
    # 按分类组织数据
    categories_data = {
        'hardware': [],
        'software': [],
        'gesture-design': []
    }
    
    for paper in all_papers:
        category = paper.get('category', 'hardware')
        if category in categories_data:
            categories_data[category].append(paper)
        else:
            # 如果分类不在预定义的三个中，放入hardware
            categories_data['hardware'].append(paper)
    
    # 生成统计信息
    stats = {
        'totalPapers': len(all_papers),
        'categories': {
            'hardware': len(categories_data['hardware']),
            'software': len(categories_data['software']),
            'gesture-design': len(categories_data['gesture-design'])
        },
        'yearRange': {
            'min': min(int(p['year']) for p in all_papers if p['year'].isdigit() and p.get('image')) if all_papers else 2020,
            'max': max(int(p['year']) for p in all_papers if p['year'].isdigit() and p.get('image')) if all_papers else 2025
        }
    }
    
    # 创建完整的数据对象
    data = {
        'papers': all_papers,
        'categories': categories_data,
        'stats': stats
    }
    
    # 生成JavaScript文件
    js_content = f"""// 自动生成的论文数据文件 V3
// 只包含Papers文件夹中的图片
// 生成时间: {__import__('datetime').datetime.now().isoformat()}

const PAPERS_DATA = {json.dumps(data, indent=2, ensure_ascii=False)};

// 导出数据
if (typeof module !== 'undefined' && module.exports) {{
    module.exports = PAPERS_DATA;
}}
"""
    
    output_path = Path('/Users/lichuanpeng/Desktop/网站/papers-data-new.js')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"✅ 生成JavaScript数据文件: papers-data-new.js")
    return stats

def main():
    """主函数"""
    print("=" * 50)
    print("开始处理数据（V3版本 - 只处理Papers文件夹）...")
    print("=" * 50)
    
    # 1. 处理CSV数据（获取标签信息）
    print("\n📊 处理CSV数据（获取标签信息）...")
    papers_from_csv = process_csv_data()
    print(f"  从CSV读取了 {len(papers_from_csv)} 条论文标签数据")
    
    # 2. 扫描Papers文件夹的图片
    print("\n🖼️  扫描Papers文件夹中的图片...")
    image_data = scan_papers_folders()
    total_images = sum(len(imgs) for imgs in image_data.values())
    print(f"  Papers文件夹总计: {total_images} 张图片")
    for cat, imgs in image_data.items():
        cat_name = {
            'hardware': 'Hardware',
            'software': 'Software',
            'gesture-design': 'Gesture Design'
        }.get(cat, cat)
        print(f"    • {cat_name}: {len(imgs)} 张")
    
    # 3. 匹配CSV数据和Papers图片
    print("\n🔗 匹配CSV数据和Papers图片...")
    papers_with_images = match_papers_with_images(papers_from_csv, image_data)
    
    # 4. 为Papers中未匹配的图片创建条目
    print("\n📝 为Papers中未匹配的图片创建条目...")
    standalone_papers = create_standalone_image_entries(image_data, papers_with_images)
    print(f"  创建了 {len(standalone_papers)} 条独立条目")
    
    # 5. 合并所有数据（只包含有图片的论文）
    all_papers = []
    # 添加有图片的CSV数据
    for paper in papers_with_images:
        if paper.get('image'):
            all_papers.append(paper)
    # 添加独立的图片条目
    all_papers.extend(standalone_papers)
    
    print(f"\n📚 总共 {len(all_papers)} 篇论文（全部来自Papers文件夹）")
    
    # 6. 生成JavaScript文件
    print("\n💾 生成JavaScript数据文件...")
    stats = generate_javascript_file(all_papers)
    
    print("\n" + "=" * 50)
    print("✨ 数据处理完成！")
    print("=" * 50)
    print(f"📊 统计信息:")
    print(f"  - 总论文数: {stats['totalPapers']}")
    print(f"  - 年份范围: {stats['yearRange']['min']}-{stats['yearRange']['max']}")
    print(f"  - 分类统计:")
    for cat, count in stats['categories'].items():
        cat_name = {
            'hardware': 'Hardware',
            'software': 'Software',
            'gesture-design': 'Gesture Design'
        }.get(cat, cat)
        print(f"    • {cat_name}: {count} 篇")
    
    print("\n💡 注意：现在只显示Papers文件夹中的图片，不包含Tags文件夹的图片")

if __name__ == '__main__':
    main()
