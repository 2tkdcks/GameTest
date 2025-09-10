import streamlit as st
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import re
import io
import numpy as np
import cv2 # OpenCV for image processing

# --------------------------------------------------------------------------
# Tesseract 경로 설정 (로컬 개발 환경에서만 필요, Streamlit Cloud에서는 무시됨)
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Streamlit 웹페이지 기본 설정
# --------------------------------------------------------------------------
st.set_page_config(page_title="메이플 장비 비교기", page_icon="🍁", layout="wide")
st.title("🍁 메이플스토리 장비 스탯 비교기")
st.write("현재 장비와 새로운 장비의 스크린샷을 업로드하거나 붙여넣기하여 주스탯% 효율을 비교하세요.")

# --------------------------------------------------------------------------
# [중요] 사용자 설정 영역: 사이드바에서 효율 설정
# --------------------------------------------------------------------------
st.sidebar.header("⚙️ 스탯 효율 설정 (주스탯% 기준)")
st.sidebar.write("자신의 스펙 계산기 결과에 맞게 수정하세요.")

# 캐릭터의 주스탯을 선택
main_stat_options = ['INT', 'STR', 'DEX', 'LUK']
MAIN_STAT = st.sidebar.selectbox("내 캐릭터의 주스탯", main_stat_options, index=0)

# 효율표를 딕셔너리로 묶어서 관리
# 이 기본값은 예시이며, 사용자 정의 값으로 덮어씌워집니다.
default_efficiencies = {
    '주스탯': 0.097,
    '부스탯': 0.009,
    '주스탯%': 1.0,
    '부스탯%': 0.119,
    '마력': 0.267,
    '공격력': 0.267, # 마법사가 아닌 직업군을 위해 공격력도 추가
    '마력%': 4.63,
    '올스탯%': 1.12,
    '크리티컬 데미지%': 3.98,
    '데미지%': 1.0,
}

# 사이드바에 숫자 입력 필드 생성
efficiencies_input = {}
with st.sidebar.expander("세부 효율 조정하기", expanded=True):
    efficiencies_input['주스탯'] = st.number_input(f"{MAIN_STAT} 1당", value=default_efficiencies['주스탯'], format="%.3f")
    # 주스탯 %는 주스탯%_ 키로 사용될 것이므로, 여기서는 {MAIN_STAT}_% 로 명시
    efficiencies_input[f'{MAIN_STAT}%'] = st.number_input(f"{MAIN_STAT}% 1%당", value=default_efficiencies['주스탯%'], format="%.2f")
    efficiencies_input['올스탯%'] = st.number_input("올스탯% 1%당", value=default_efficiencies['올스탯%'], format="%.2f")
    efficiencies_input['공격력_마력'] = st.number_input("공격력/마력 1당", value=default_efficiencies['마력'], format="%.3f") # 통일된 입력 필드
    efficiencies_input['데미지%'] = st.number_input("데미지% 1%당", value=default_efficiencies['데미지%'], format="%.2f")
    efficiencies_input['크리티컬 데미지%'] = st.number_input("크리티컬 데미지% 1%당", value=default_efficiencies['크리티컬 데미지%'], format="%.2f")

# 입력받은 값으로 최종 stat_efficiencies 딕셔너리 생성
stat_efficiencies = {
    # 주스탯 및 주스탯% 설정
    MAIN_STAT: efficiencies_input['주스탯'],
    f'{MAIN_STAT}_%': efficiencies_input[f'{MAIN_STAT}%'],
    
    # 올스탯 %
    '올스탯_%': efficiencies_input['올스탯%'],
    
    # 공격력/마력 (같은 효율을 사용하도록)
    '공격력': efficiencies_input['공격력_마력'],
    '마력': efficiencies_input['공격력_마력'],
    
    # 데미지/크뎀 %
    '데미지_%': efficiencies_input['데미지%'],
    '크리티컬 데미지_%': efficiencies_input['크리티컬 데미지%'],
    
    # 계산에서 제외할 스탯 (0으로 설정)
    'STR': 0, 'DEX': 0, 'INT': 0, 'LUK': 0, 'HP': 0, 'MP': 0,
    'STR_%':0, 'DEX_%':0, 'INT_%':0, 'LUK_%':0, '마력_%':0, # 마력%는 잠재에 잘 안 나와서 일단 0, 필요시 추가
    '방어율 무시_%': 0, '보스데미지_%': 0, 
}
# 부스탯의 INT, LUK, STR, DEX는 MAIN_STAT에 따라 효율이 달라질 수 있음.
# 현재 MAIN_STAT에 따라 주스탯은 MAIN_STAT으로, 나머지는 0으로 설정
for stat in main_stat_options:
    if stat != MAIN_STAT:
        stat_efficiencies[stat] = 0
        stat_efficiencies[f'{stat}_%'] = 0

# Streamlit Cloud에서 pytesseract가 tesseract 경로를 찾도록 환경 변수 설정
# GitHub 레포지토리에 .streamlit/config.toml 파일을 만들고 
# [general]
#  tesseract_cmd = "/usr/bin/tesseract"
# 추가하는 것이 더 안정적일 수 있습니다.
# st.experimental_singleton(lambda: pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract")()


# --------------------------------------------------------------------------
# OCR 인식률 강화를 위한 이미지 전처리 함수 추가 (OpenCV 사용)
# --------------------------------------------------------------------------
def preprocess_image_for_ocr(image):
    # PIL Image를 OpenCV 이미지(numpy array)로 변환
    img_np = np.array(image)
    
    # 그레이스케일 변환
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    
    # 대비 강조 (CLAHE - Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)

    # 노이즈 제거 (가우시안 블러)
    denoised = cv2.GaussianBlur(enhanced, (1, 1), 0) # 1,1 커널로 최소한의 블러

    # 이진화 (Adaptive Thresholding)
    # 글자 크기가 가변적이므로, 전역 이진화보다 적응형 이진화가 유리
    thresh = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY_INV, 11, 2) # THRESH_BINARY_INV로 글자를 흰색으로 만듦

    # 글자 확대를 위한 Dilation (선택 사항, 글자가 너무 얇을 때)
    # kernel = np.ones((1,1), np.uint8)
    # dilated = cv2.dilate(thresh, kernel, iterations=1)
    # return Image.fromarray(dilated)

    # 다시 PIL Image로 변환하여 반환
    return Image.fromarray(thresh)


# --------------------------------------------------------------------------
# 기존 분석 로직 (함수 부분)
# --------------------------------------------------------------------------
# 캐시를 사용하지 않음 (전처리 및 Tesseract 설정 변경으로 인해, 필요시 다시 추가)
# @st.cache_data
def extract_text_from_image(image_bytes, image_key):
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB') # OpenCV 호환을 위해 RGB 변환
        
        # 이미지 전처리 적용
        processed_image = preprocess_image_for_ocr(image)
        
        # 디버깅용: 전처리된 이미지 표시 (선택 사항)
        # st.sidebar.image(processed_image, caption=f"{image_key} 전처리 이미지", width=100)

        # Tesseract OCR 설정 (PSM, OEM)
        # --psm 4: 단일 텍스트 블록으로 가정하고 텍스트 인식 (아이템 툴팁처럼)
        # --oem 3: LSTM 기반 최신 엔진 사용 (가장 정확)
        custom_config = r'--psm 6 --oem 3' # psm 6: 단일 균일한 텍스트 블록으로 가정
        text = pytesseract.image_to_string(processed_image, lang='kor', config=custom_config)
        return text
    except Exception as e:
        st.error(f"이미지 '{image_key}' 처리 중 오류 발생: {e}")
        return ""

def parse_stats(text):
    stats = {
        'STR': 0, 'DEX': 0, 'INT': 0, 'LUK': 0, 'HP': 0, 'MP': 0, 
        '공격력': 0, '마력': 0, '올스탯_%': 0, 'STR_%': 0, 'DEX_%': 0, 
        'INT_%': 0, 'LUK_%': 0, '마력_%': 0, '데미지_%': 0, 
        '보스데미지_%': 0, '크리티컬 데미지_%': 0, '방어율 무시_%': 0
    }
    lines = text.split('\n')
    for line in lines:
        line = line.replace(' ', '')
        
        # 기본 스탯 (괄호 안의 숫자 포함)
        match_base = re.search(r'^(STR|DEX|INT|LUK|공격력|마력)\s*:\s*\+(\d+)(\s*\(\+(\d+)\))?', line)
        if match_base:
            stat_name = match_base.group(1)
            base_value = int(match_base.group(2))
            extra_value = int(match_base.group(4)) if match_base.group(4) else 0
            stats[stat_name] += base_value + extra_value
            continue # 이 줄에서 처리했으면 다음 라인으로
            
        # 퍼센트 스탯 (잠재/에디)
        match_percent = re.search(r'^(올스탯|STR|DEX|INT|LUK|마력|데미지|크리티컬데미지|보스몬스터공격시데미지|몬스터방어율무시)\s*:\s*\+(\d+)%', line)
        if match_percent:
            stat_name, value = match_percent.group(1), int(match_percent.group(2))
            key_map = {'올스탯': '올스탯_%', 'STR': 'STR_%', 'DEX': 'DEX_%', 'INT': 'INT_%', 'LUK': 'LUK_%', '마력': '마력_%', '데미지': '데미지_%', '크리티컬데미지': '크리티컬 데미지_%', '보스몬스터공격시데미지': '보스데미지_%', '몬스터방어율무시': '방어율 무시_%'}
            if stat_name in key_map: stats[key_map[stat_name]] += value
            continue # 이 줄에서 처리했으면 다음 라인으로
            
    return stats


def calculate_equivalent_main_stat_percent(stats):
    total_percent = 0
    for stat_name, stat_value in stats.items():
        efficiency = stat_efficiencies.get(stat_name, 0)
        total_percent += stat_value * efficiency
    return total_percent

# --------------------------------------------------------------------------
# 웹사이트 레이아웃 구성
# --------------------------------------------------------------------------
col1, col2 = st.columns(2)

with col1:
    st.subheader("📸 현재 착용 장비")
    equipped_image_file = st.file_uploader("클릭 또는 이미지 붙여넣기 (Ctrl+V)", key="equipped", type=['png', 'jpg', 'jpeg'])
    if equipped_image_file:
        st.image(equipped_image_file, caption="업로드된 현재 장비", use_column_width=True)

with col2:
    st.subheader("✨ 새로운 장비")
    new_item_image_file = st.file_uploader("클릭 또는 이미지 붙여넣기 (Ctrl+V)", key="new", type=['png', 'jpg', 'jpeg'])
    if new_item_image_file:
        st.image(new_item_image_file, caption="업로드된 새로운 장비", use_column_width=True)

st.divider()

if st.button("🚀 분석 시작하기!", use_container_width=True):
    if equipped_image_file and new_item_image_file:
        with st.spinner('장비 옵션을 읽는 중... (시간이 다소 소요될 수 있습니다)'):
            equipped_bytes = equipped_image_file.getvalue()
            new_item_bytes = new_item_image_file.getvalue()

            equipped_text = extract_text_from_image(equipped_bytes, "현재 장비")
            new_item_text = extract_text_from_image(new_item_bytes, "새로운 장비")
            
            # 디버깅용: 추출된 텍스트 확인
            # st.text("--- 현재 장비 추출 텍스트 ---")
            # st.text(equipped_text)
            # st.text("--- 새 장비 추출 텍스트 ---")
            # st.text(new_item_text)

            equipped_stats = parse_stats(equipped_text)
            new_item_stats = parse_stats(new_item_text)

            equipped_total_percent = calculate_equivalent_main_stat_percent(equipped_stats)
            new_item_total_percent = calculate_equivalent_main_stat_percent(new_item_stats)
            diff = new_item_total_percent - equipped_total_percent
        
        st.success("분석 완료!")
        st.subheader("📊 분석 결과")
        
        res_col1, res_col2, res_col3 = st.columns(3)
        res_col1.metric("현재 장비 등급", f"{equipped_total_percent:.2f}%")
        res_col2.metric("새 장비 등급", f"{new_item_total_percent:.2f}%")
        res_col3.metric("효율 증감", f"{diff:+.2f}%", delta=f"{diff:+.2f}%")
        
        st.markdown("---")
        st.subheader("🔍 상세 스탯 파싱 결과 (디버깅용)")
        st.write("### 현재 장비 스탯")
        st.json(equipped_stats)
        st.write("### 새로운 장비 스탯")
        st.json(new_item_stats)


    else:
        st.warning("두 장비의 이미지를 모두 업로드해주세요.")
