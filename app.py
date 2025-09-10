import streamlit as st
import pytesseract
from PIL import Image
import re
import io

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
default_efficiencies = {
    '주스탯': 0.097,
    '부스탯': 0.009,
    '주스탯%': 1.0,
    '부스탯%': 0.119,
    '마력': 0.267,
    '공격력': 0.267,
    '마력%': 4.63,
    '올스탯%': 1.12,
    '크리티컬 데미지%': 3.98,
    '데미지%': 1.0,
}

# 사이드바에 숫자 입력 필드 생성
efficiencies_input = {}
with st.sidebar.expander("세부 효율 조정하기", expanded=True):
    efficiencies_input['주스탯'] = st.number_input(f"{MAIN_STAT} 1당", value=default_efficiencies['주스탯'], format="%.3f")
    efficiencies_input['주스탯%'] = st.number_input(f"{MAIN_STAT}% 1%당", value=default_efficiencies['주스탯%'], format="%.2f")
    efficiencies_input['올스탯%'] = st.number_input("올스탯% 1%당", value=default_efficiencies['올스탯%'], format="%.2f")
    efficiencies_input['공격력/마력'] = st.number_input("공격력/마력 1당", value=default_efficiencies['마력'], format="%.3f")
    efficiencies_input['데미지%'] = st.number_input("데미지% 1%당", value=default_efficiencies['데미지%'], format="%.2f")
    efficiencies_input['크리티컬 데미지%'] = st.number_input("크리티컬 데미지% 1%당", value=default_efficiencies['크리티컬 데미지%'], format="%.2f")

# 입력받은 값으로 최종 stat_efficiencies 딕셔너리 생성
stat_efficiencies = {
    MAIN_STAT: efficiencies_input['주스탯'],
    f'{MAIN_STAT}_%': efficiencies_input['주스탯%'],
    '올스탯_%': efficiencies_input['올스탯%'],
    '공격력': efficiencies_input['공격력/마력'],
    '마력': efficiencies_input['공격력/마력'],
    '데미지_%': efficiencies_input['데미지%'],
    '크리티컬 데미지_%': efficiencies_input['크리티컬 데미지%'],
    # 계산에서 제외할 스탯들
    'STR': 0, 'DEX': 0, 'INT': 0, 'LUK': 0, 'HP': 0, 'MP': 0,
    'STR_%':0, 'DEX_%':0, 'INT_%':0, 'LUK_%':0,
    '방어율 무시_%': 0, '보스데미지_%': 0,
}
# 주스탯/주스탯%는 위에서 이미 설정했으므로 다시 덮어씀
stat_efficiencies[MAIN_STAT] = efficiencies_input['주스탯']
stat_efficiencies[f'{MAIN_STAT}_%'] = efficiencies_input['주스탯%']


# --------------------------------------------------------------------------
# 기존 분석 로직 (함수 부분은 거의 동일)
# --------------------------------------------------------------------------
@st.cache_data
def extract_text_from_image(image_bytes):
    try:
        image = Image.open(io.BytesIO(image_bytes))
        text = pytesseract.image_to_string(image, lang='kor')
        return text
    except Exception as e:
        st.error(f"이미지 처리 중 오류 발생: {e}")
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
        match = re.search(r'^(STR|DEX|INT|LUK|공격력|마력)\s*:\s*\+(\d+)', line)
        if match:
            stat_name = match.group(1)
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats[stat_name] += sum(int(n) for n in numbers)
            continue
        match = re.search(r'^(올스탯|STR|DEX|INT|LUK|마력|데미지|크리티컬데미지|보스몬스터공격시데미지|몬스터방어율무시)\s*:\s*\+(\d+)%', line)
        if match:
            stat_name, value = match.group(1), int(match.group(2))
            key_map = {'올스탯': '올스탯_%', 'STR': 'STR_%', 'DEX': 'DEX_%', 'INT': 'INT_%', 'LUK': 'LUK_%', '마력': '마력_%', '데미지': '데미지_%', '크리티컬데미지': '크리티컬 데미지_%', '보스몬스터공격시데미지': '보스데미지_%', '몬스터방어율무시': '방어율 무시_%'}
            if stat_name in key_map: stats[key_map[stat_name]] += value
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
        st.image(equipped_image_file, caption="업로드된 현재 장비")

with col2:
    st.subheader("✨ 새로운 장비")
    new_item_image_file = st.file_uploader("클릭 또는 이미지 붙여넣기 (Ctrl+V)", key="new", type=['png', 'jpg', 'jpeg'])
    if new_item_image_file:
        st.image(new_item_image_file, caption="업로드된 새로운 장비")

st.divider()

if st.button("🚀 분석 시작하기!", use_container_width=True):
    if equipped_image_file and new_item_image_file:
        with st.spinner('장비 옵션을 읽는 중...'):
            # 이미지 파일의 바이트 데이터를 읽어옴
            equipped_bytes = equipped_image_file.getvalue()
            new_item_bytes = new_item_image_file.getvalue()

            # 텍스트 추출 및 스탯 파싱
            equipped_text = extract_text_from_image(equipped_bytes)
            new_item_text = extract_text_from_image(new_item_bytes)
            
            equipped_stats = parse_stats(equipped_text)
            new_item_stats = parse_stats(new_item_text)

            # 주스탯% 등급 계산
            equipped_total_percent = calculate_equivalent_main_stat_percent(equipped_stats)
            new_item_total_percent = calculate_equivalent_main_stat_percent(new_item_stats)
            diff = new_item_total_percent - equipped_total_percent
        
        st.success("분석 완료!")
        st.subheader("📊 분석 결과")
        
        res_col1, res_col2, res_col3 = st.columns(3)
        res_col1.metric("현재 장비 등급", f"{equipped_total_percent:.2f}%")
        res_col2.metric("새 장비 등급", f"{new_item_total_percent:.2f}%")
        res_col3.metric("효율 증감", f"{diff:.2f}%", delta=f"{diff:.2f}%")

    else:
        st.warning("두 장비의 이미지를 모두 업로드해주세요.")
