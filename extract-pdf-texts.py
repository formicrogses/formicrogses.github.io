#!/usr/bin/env python3
"""
PDF文本提取脚本
提取所有论文PDF的文本内容，保存为JSON格式
"""

import os
import json
import sys
from pathlib import Path

def clean_text(text):
    """
    清理文本，移除特殊字符
    """
    import re
    # 移除surrogate字符
    text = text.encode('utf-8', 'ignore').decode('utf-8', 'ignore')
    # 移除控制字符（保留换行和制表符）
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)
    return text

def extract_text_from_pdf(pdf_path):
    """
    从PDF文件提取文本
    支持多种PDF库
    """
    try:
        # 尝试使用 PyMuPDF (fitz)
        import fitz
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return clean_text(text.strip())
    except ImportError:
        pass
    
    try:
        # 尝试使用 PyPDF2
        import PyPDF2
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
        return clean_text(text.strip())
    except ImportError:
        pass
    
    try:
        # 尝试使用 pdfplumber
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text
        return clean_text(text.strip())
    except ImportError:
        pass
    
    print(f"错误: 未安装PDF处理库。请安装：")
    print("  pip install PyMuPDF  (推荐，速度快)")
    print("  或 pip install PyPDF2")
    print("  或 pip install pdfplumber")
    sys.exit(1)

def get_paper_title_from_filename(filename):
    """
    从文件名提取论文标题
    """
    # 移除扩展名
    title = filename.replace('.pdf', '')
    
    # 移除年份前缀（如 "2020 - "）
    import re
    title = re.sub(r'^\d{4}\s*-\s*', '', title)
    
    return title.strip()

def process_papers(papers_dir, output_file):
    """
    处理所有PDF文件
    """
    papers_data = {}
    total = 0
    success = 0
    failed = []
    
    # 遍历所有PDF文件
    for root, dirs, files in os.walk(papers_dir):
        for filename in files:
            if not filename.endswith('.pdf'):
                continue
            
            total += 1
            pdf_path = os.path.join(root, filename)
            
            # 获取相对路径（用于匹配papers-data-new.js中的数据）
            rel_path = os.path.relpath(pdf_path, papers_dir)
            
            print(f"处理 [{total}]: {filename}...", end=' ')
            
            try:
                # 提取文本
                text = extract_text_from_pdf(pdf_path)
                
                if not text or len(text) < 100:
                    print("❌ 文本过短或为空")
                    failed.append(filename)
                    continue
                
                # 获取文件信息
                file_size = os.path.getsize(pdf_path)
                title = get_paper_title_from_filename(filename)
                
                # 存储数据
                papers_data[filename] = {
                    'title': title,
                    'filename': filename,
                    'path': rel_path,
                    'text': text,
                    'length': len(text),
                    'size': file_size,
                    'preview': text[:500] + '...' if len(text) > 500 else text
                }
                
                success += 1
                print(f"✅ ({len(text)} 字符)")
                
            except Exception as e:
                print(f"❌ 错误: {str(e)}")
                failed.append(filename)
    
    # 保存结果
    print(f"\n正在保存到 {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(papers_data, f, ensure_ascii=False, indent=2)
    
    # 统计信息
    print(f"\n" + "="*60)
    print(f"处理完成!")
    print(f"总数: {total} 篇")
    print(f"成功: {success} 篇")
    print(f"失败: {len(failed)} 篇")
    
    if failed:
        print(f"\n失败的文件:")
        for f in failed[:10]:
            print(f"  - {f}")
        if len(failed) > 10:
            print(f"  ... 还有 {len(failed) - 10} 个")
    
    # 生成统计
    total_chars = sum(p['length'] for p in papers_data.values())
    avg_chars = total_chars / success if success > 0 else 0
    
    print(f"\n文本统计:")
    print(f"总字符数: {total_chars:,}")
    print(f"平均字符: {avg_chars:,.0f}")
    print(f"文件大小: {os.path.getsize(output_file) / 1024 / 1024:.2f} MB")
    print("="*60)
    
    return papers_data

def main():
    # 配置
    base_dir = Path(__file__).parent
    papers_dir = base_dir / "Papers"
    output_file = base_dir / "papers-texts.json"
    
    print("📚 PDF文本提取工具")
    print("="*60)
    print(f"论文目录: {papers_dir}")
    print(f"输出文件: {output_file}")
    print("="*60)
    
    if not papers_dir.exists():
        print(f"错误: 找不到Papers目录: {papers_dir}")
        sys.exit(1)
    
    # 开始处理
    papers_data = process_papers(papers_dir, output_file)
    
    print(f"\n✅ 全部完成! 数据已保存到: {output_file}")

if __name__ == "__main__":
    main()
