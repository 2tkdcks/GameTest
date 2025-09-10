import streamlit as st
import pytesseract
from PIL import Image
import re
import io
import numpy as np
import cv2

# --- Streamlit 웹페이지 기본 설정 ---
st.set_page_config(page_title="메이플 장비 비교기", page_icon="🍁", layout="wide")
st.title("🍁 메이플스토리 장비 스탯 비교기")
st.write("현재 장비와 새로운 장비의 스크린샷을 업로드하거나 붙여넣기하여 주스탯% 효율을 비교하세요.")

# --- 사용자 설정 사이드바 ---
st.sidebar.header("⚙️ 스탯 효율 설정 (주스탯% 기준)")
main_stat_options = ['INT', 'STR', 'DEX', 'LUK']
MAIN_STAT = st.sidebar.selectbox("내 캐릭터의 주스탯", main_stat_options, index=0)

default_efficiencies = {'주스탯': 0.097, '주스탯%': 1.0, '올스탯%': 1.12, '공격력/마력': 0.267, '데미지%': 1.0, '크리티컬 데미지%': 3.98}
efficiencies_input = {}
with st.sidebar.expander("세부 효율 조정하기", expanded=True):
    efficiencies_input['주스탯'] = st.number_input(f"{MAIN_STAT} 1당", value=default_efficiencies['주스탯'], format="%.3f")
    efficiencies_input[f'{MAIN_STAT}%'] = st.number_input(f"{MAIN_STAT}% 1%당", value=default_efficiencies['주스탯%'], format="%.2f")
    efficiencies_input['올스탯%'] = st.number_input("올스탯% 1%당", value=default_efficiencies['올스탯%'], format="%.2f")
    efficiencies_input['공격력_마력'] = st.number_input("공격력/마력 1당", value=default_efficiencies['공격력/마력'], format="%.3f")
    efficiencies_input['데미지%'] = st.number_input("데미지% 1%당", value=default_efficiencies['데미지%'], format="%.2f")
    efficiencies_input['크리티컬 데미지%'] = st.number_input("크리티컬 데미지% 1%당", value=default_efficiencies['크리티컬 데미지%'], format="%.2f")

stat_efficiencies = {
    MAIN_STAT: efficiencies_input['주스탯'], f'{MAIN_STAT}_%': efficiencies_input[f'{MAIN_STAT}%'],
    '올스탯_%': efficiencies_input['올스탯%'], '공격력': efficiencies_input['공격력_마력'], '마력': efficiencies_input['공격력_마력'],
    '데미지_%': efficiencies_input['데미지%'], '크리티컬 데미지_%': efficiencies_input['크리티컬 데미지%'],
}

# --- 이미지 처리 및 OCR 함수 ---

def preprocess_image_for_ocr(image):
    """
    [최종 개선] 이미지 확대 + 흑백 변환으로 OCR 인식률 극대화
    """
    img_np = np.array(image.convert('L'))
    
    # 1. 이미지 크기를 2배로 확대 (Upscaling)
    h, w = img_np.shape
    upscaled = cv2.resize(img_np, (w*2, h*2), interpolation=cv2.INTER_LINEAR)
    
    # 2. Otsu 이진화 적용
    _, thresh = cv2.threshold(upscaled, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    return Image.fromarray(thresh)

def extract_text_from_image(image_bytes, image_key):
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        processed_image = preprocess_image_for_ocr(image)
        custom_config = r'--oem 3 --psm 6'
        text = pytesseract.image_to_string(processed_image, lang='kor', config=custom_config)
        return text
    except Exception as e:
        st.error(f"'{image_key}' 처리 중 오류: {e}")
        return ""

def parse_stats(text):
    """
    [최종 개선] 유연한 스탯 파서
    - 한 줄씩 읽으면서 키워드와 숫자를 찾아내는 방식으로 변경
    """
    stats = {
        'STR': 0, 'DEX': 0, 'INT': 0, 'LUK': 0, 'HP': 0, 'MP': 0, '공격력': 0, '마력': 0,
        '올스탯_%': 0, 'STR_%': 0, 'DEX_%': 0, 'INT_%': 0, 'LUK_%': 0, '마력_%': 0,
        '데미지_%': 0, '보스데미지_%': 0, '크리티컬 데미지_%': 0, '방어율 무시_%': 0
    }
    
    lines = text.split('\n')
    for line in lines:
        # 퍼센트(%) 스탯 먼저 확인 (더 구체적인 조건이므로)
        if '%' in line:
            # 올스탯% 또는 주스탯%
            if any(keyword in line for keyword in ["올스", "스탯", "스탠"]):
                numbers = re.findall(r'(\d+)\s*%', line)
                if numbers: stats['올스탯_%'] += sum(int(n) for n in numbers)
            if 'INT' in line:
                numbers = re.findall(r'(\d+)\s*%', line)
                if numbers: stats['INT_%'] += sum(int(n) for n in numbers)
            if 'DEX' in line:
                numbers = re.findall(r'(\d+)\s*%', line)
                if numbers: stats['DEX_%'] += sum(int(n) for n in numbers)
            if 'STR' in line:
                numbers = re.findall(r'(\d+)\s*%', line)
                if numbers: stats['STR_%'] += sum(int(n) for n in numbers)
            if 'LUK' in line:
                numbers = re.findall(r'(\d+)\s*%', line)
                if numbers: stats['LUK_%'] += sum(int(n) for n in numbers)
            # 기타 % 스탯
            if any(keyword in line for keyword in ["마력", "마련"]):
                numbers = re.findall(r'(\d+)\s*%', line)
                if numbers: stats['마력_%'] += sum(int(n) for n in numbers)
            if any(keyword in line for keyword in ["데미지", "머지"]):
                numbers = re.findall(r'(\d+)\s*%', line)
                if numbers: stats['데미지_%'] += sum(int(n) for n in numbers)
            if any(keyword in line for keyword in ["크리티컬", "크리"]):
                numbers = re.findall(r'(\d+)\s*%', line)
                if numbers: stats['크리티컬 데미지_%'] += sum(int(n) for n in numbers)

        # 일반 스탯 (숫자만 있는 경우)
        else:
            numbers = [int(n) for n in re.findall(r'\d+', line)]
            if not numbers: continue
            
            # 괄호 안의 숫자까지 모두 더함
            total_value = sum(numbers)

            if 'INT' in line: stats['INT'] += total_value
            elif 'DEX' in line: stats['DEX'] += total_value
            elif 'STR' in line: stats['STR'] += total_value
            elif 'LUK' in line: stats['LUK'] += total_value
            elif any(keyword in line for keyword in ["공격력", "공격"]): stats['공격력'] += total_value
            elif any(keyword in line for keyword in ["마력", "마련"]): stats['마력'] += total_value
            elif '최대 HP' in line or '대배' in line: stats['HP'] += total_value
            elif '최대 MP' in line: stats['MP'] += total_value
            
    return stats

def calculate_equivalent_main_stat_percent(stats):
    total_percent = 0
    for stat_name, stat_value in stats.items():
        efficiency = stat_efficiencies.get(stat_name, 0)
        if efficiency > 0:
            total_percent += stat_value * efficiency
    return total_percent

# --- 웹사이트 레이아웃 ---
col1, col2 = st.columns(2)
with col1:
    st.subheader("📸 현재 착용 장비")
    equipped_image_file = st.file_uploader("클릭 또는 이미지 붙여넣기 (Ctrl+V)", key="equipped", type=['png', 'jpg', 'jpeg'])
    if equipped_image_file: st.image(equipped_image_file, caption="업로드된 현재 장비", use_container_width=True)
with col2:
    st.subheader("✨ 새로운 장비")
    new_item_file = st.file_uploader("클릭 또는 이미지 붙여넣기 (Ctrl+V)", key="new", type=['png', 'jpg', 'jpeg'])
    if new_item_file: st.image(new_item_file, caption="업로드된 새로운 장비", use_container_width=True)

st.divider()

if st.button("🚀 분석 시작하기!", use_container_width=True):
    if equipped_image_file and new_item_file:
        with st.spinner('장비 옵션을 읽는 중... (최종 분석)'):
            equipped_bytes = equipped_image_file.getvalue()
            new_item_bytes = new_item_file.getvalue()
            equipped_text = extract_text_from_image(equipped_bytes, "현재 장비")
            new_item_text = extract_text_from_image(new_item_bytes, "새로운 장비")
            equipped_stats = parse_stats(equipped_text)
            new_item_stats = parse_stats(new_item_text)
            equipped_total = calculate_equivalent_main_stat_percent(equipped_stats)
            new_item_total = calculate_equivalent_main_stat_percent(new_item_stats)
            diff = new_item_total - equipped_total
        
        st.success("분석 완료!")
        st.subheader("📊 분석 결과")
        res_col1, res_col2, res_col3 = st.columns(3)
        res_col1.metric("현재 장비 등급", f"{equipped_total:.2f}%")
        res_col2.metric("새 장비 등급", f"{new_item_total:.2f}%")
        res_col3.metric("효율 증감", f"{diff:+.2f}%", delta=f"{diff:+.2f}%")

        # 디버깅 섹션
        with st.expander("자세한 분석 내용 보기 (디버깅용)"):
            st.subheader("🕵️‍♂️ OCR 원본 텍스트 (Raw Text)")
            text_col1, text_col2 = st.columns(2)
            with text_col1: st.text_area("현재 장비", equipped_text, height=300)
            with text_col2: st.text_area("새 장비", new_item_text, height=300)
            st.subheader("🔍 상세 스탯 파싱 결과")
            json_col1, json_col2 = st.columns(2)
            with json_col1: st.json(equipped_stats)
            with json_col2: st.json(new_item_stats)
    else:
        st.warning("두 장비의 이미지를 모두 업로드해주세요.")
