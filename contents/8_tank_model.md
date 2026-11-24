---
downloads:
  - file: ../data/dam_urayama_daily.csv
    filename: dam_urayama_daily.csv
    title: 浦山ダムの日データ（CSV）
  - file: ../data/precipitation_chichibu_daily.csv
    filename: precipitation_chichibu_daily.csv
    title: 秩父の日降水量（CSV）
---

# 第8回　河川・ダムモデルの発展

### 今回の位置付け

1. 現象の理解
2. <span style="color:red">仮定の設定</span>
3. <span style="color:red">数理モデルの構築</span>
4. 数値シミュレーション
5. データとの比較
6. パラメタ推定
7. <span style="color:red">モデルの検証と改善</span>

- **第6回**：流入量と放流量を観測データとして与え，ダムの貯水量を計算した．
- **第7回**：残差関数を作って係数を推定し，係数を固定した別の期間への適用結果を評価した．
- **第8回**：ダム上流の集水域を対象とし，**降水量からダムへの流入量を計算する**．貯留と流出の仮定を加え，単一タンクと並列2タンクを比較する．

### 到達目標

今回は**降水量から流入量を求めるモデル**を構築し，**連立微分方程式**で二つの貯留量の時間変化を計算する．

- **モデルの構築**：保存則と，流出量が貯留量に比例するという仮定から，単一タンクの微分方程式を立てられる．
- **係数の解釈**：降水量を水量に換算し，流出に寄与する割合と減衰の時定数を説明できる．
- **モデルの発展**：二つの貯留量を状態変数として計算し，異なる速さで減衰する流出を表せる．
- **比較と評価**：同じデータ・誤差指標で二つのモデルを比較し，係数を固定した未使用データへの適用結果を報告できる．

<!--
105分の目安：準備・降水量と流入量の確認15分，単位と単一タンク・演習1に20分，推定・演習2に20分，並列2タンク・演習3・4に30分，別年への適用とまとめ・課題に20分．補足・発展課題は自主学習用．
-->

## 準備

````{note} 演習0：作業フォルダとNotebookの準備

1. ターミナルで第8回の作業フォルダを作成せよ．

```bash
mkdir -p ~/applied_programming_ii/08
cd ~/applied_programming_ii/08
mkdir -p notebooks reports/figures
```

作成する構成は次のとおりである．`data`は各回で共通に使う．

```text
applied_programming_ii/
├── data/
└── 08/
    ├── README.md
    ├── notebooks/
    │   └── tank_model.ipynb
    └── reports/
        └── figures/
```

2. 講義タイトル右上のダウンロードボタン（下向き矢印）を開き，浦山ダムの日データ`dam_urayama_daily.csv`と秩父の日降水量`precipitation_chichibu_daily.csv`を`~/applied_programming_ii/data/`に保存せよ．すでに保存したファイルも使用できる．
3. `notebooks/tank_model.ipynb`を作成せよ．
4. `08`フォルダに次の内容の`README.md`を作成せよ．

```markdown
# 応用プログラミングII 第8回

- 氏名：
- 学籍番号：

## 今日の目標

降水量から流入量を計算するモデルを構築し，貯留・流出の仮定を変えた結果を比較する．

## 演習1：流出係数と減衰の速さ

1. 流出係数による比較（Notebookに図を出力）
2. 減衰が速い係数と，その時定数：

## 演習2：推定期間と未使用期間の誤差

1. 期間ごとの誤差（Notebookに計算結果を出力）
2. 流入量と残差（Notebookに図を出力）

## 演習3：並列2タンクの関数の実装

1. `tank2_rhs`（Notebookに関数を定義して実行）
2. `simulate_tank2`（Notebookに関数を定義して実行）

## 演習4：タンクの番号と推定値の解釈

1. タンクの番号を入れ替えた比較（Notebookに計算結果を出力）
2. 応答の速いタンクと遅いタンクの時定数：

## 課題1：前半で推定したモデルの後半への適用

1. 単一タンクと並列2タンクの誤差（Notebookに比較表を出力）
2. 流入量と残差（Notebookに図を出力）
3. 後半の流入量をより小さいRMSEで再現したモデルと，数値による根拠：

## 課題2：並列3タンクによる流入量の推定

1. 3タンクの関数（Notebookに関数を定義して実行）
2. 2タンク・3タンクのRMSE（Notebookに比較表を出力）
3. 2020年の流入量と残差（Notebookに図を出力）
```

5. 次のコードをNotebookの最初のコードセルにまとめて入力し，実行せよ．ライブラリと保存先を設定し，必要なCSVを確認する．

<!-- cell:setup -->
```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

plt.rcParams["font.family"] = "Hiragino Sans"
PROJECT_DIR = Path.home() / "applied_programming_ii" / "08"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)
print("ダムデータの有無:", (DATA_DIR / "dam_urayama_daily.csv").exists())
print("降水量データの有無:", (DATA_DIR / "precipitation_chichibu_daily.csv").exists())
```

出力例：

```text
ダムデータの有無: True
降水量データの有無: True
```

````

## 復習と降水量データの準備

### 保存則と観測量

- **保存則**：第6回の収支式は，貯留量の変化率を流入量と流出量の差で表した．今回は集水域に入る雨水と，そこからダムへ流れ出る水に適用する．
- **観測量**：ダムの`inflow_m3s`を比較対象にする．タンクからの流出が，ダムへの流入に対応する．
- **計算・推定**：`np.interp`で観測入力を補間し，`solve_ivp`で計算する．`least_squares`にはモデルの流量−観測流量の残差配列を返す．

### データの読み込みと日付の対応

降水量は気象庁の秩父観測所，流入量は浦山ダムの日データを使う．秩父の1地点の雨量で，集水域全体の降水量を代表させる近似を置く．列・出典・品質記号の扱いは[授業用データ一覧](../data/README.md)を参照する．

二つのCSVを読み込む．

<!-- cell:read -->
```python
dam = pd.read_csv(DATA_DIR / "dam_urayama_daily.csv", parse_dates=["date"])
rain = pd.read_csv(DATA_DIR / "precipitation_chichibu_daily.csv", parse_dates=["date"])
```

降水量データの先頭5行を確認し，列名と値の形式を把握する．

<!-- cell:rain_head -->
```python
print(rain.head())
```

出力例：

```text
        date  precipitation_mm
0 2019-01-01               0.0
1 2019-01-02               0.0
2 2019-01-03               0.0
3 2019-01-04               0.0
4 2019-01-05               0.0
```

- `date`：観測日．
- `precipitation_mm`：その日の降水量（mm）．1日間に降った雨などを水深で表した値．

全期間の行数・欠損値と，日降水量の基本統計量を確認する．

<!-- cell:rain_summary -->
```python
print("期間:", rain["date"].min().date(), "〜", rain["date"].max().date())
print("行数:", len(rain))
print("欠損値の数:")
print(rain.isna().sum().to_string())
print("日降水量 [mm] の基本統計量:")
print(rain["precipitation_mm"].describe().round(2).to_string())
```

- **コードの補足**：`describe()`は，データ数・平均・標準偏差・最小値・四分位数・最大値をまとめる．`50%`は中央値を表す．

出力例：

```text
期間: 2019-01-01 〜 2023-12-31
行数: 1826
欠損値の数:
date                0
precipitation_mm    0
日降水量 [mm] の基本統計量:
count    1826.00
mean        3.66
std        15.68
min         0.00
25%         0.00
50%         0.00
75%         1.00
max       511.00
```

このCSVには2019〜2023年の1826日分があり，欠損値はない．**中央値は0 mm，最大値は511 mm**である．

2019年を取り出し，同じ日付の観測値を対応させる形でデータを結合する．

<!-- cell:prepare -->
```python
year = 2019
dam_year = dam[dam["date"].dt.year == year].reset_index(drop=True)
rain_year = rain[rain["date"].dt.year == year].reset_index(drop=True)
data = pd.merge(dam_year, rain_year, on="date", how="inner")
```

```{dropdown} コードの補足：日付をキーとする表の結合

[応用プログラミングI 第11回・演習11「CPIと完全失業率を年月で結合する」](https://seminar.k16kgw.com/Class_Josai_AppliedProgrammingI/contents/economic-data/#id-v-cpi)では，`on="年月", how="inner"`で二つの表を結合した．今回は結合キーを`date`に変え，同じ方法で流入量と降水量を対応させる．

- `on="date"`：二つの表の`date`列を照合し，同じ日付の流入量と降水量を同じ行に並べる．照合に使う列を**結合キー**と呼ぶ．
- `how="inner"`：両方の表にある日付の行だけを残す**内部結合**を指定する．片方だけにある日付は結合結果に含めない．

![date列の日付を照合し，共通する1月2日と3日の流入量・降水量を同じ行に並べる内部結合の例](figs/08/merge_on_date.svg)

図は仕組みを示す説明用のデータで，値と列を簡略化している．実際に使う2019年のデータは365日分が対応しており，次のコードで結合後の行数と日付の間隔を確認する．

**ほかの結合方法**

左の表は第1引数の`dam_year`，右の表は第2引数の`rain_year`を指す．

- `how="left"`：**左結合**．左の表の日付をすべて残す．
- `how="right"`：**右結合**．右の表の日付をすべて残す．
- `how="outer"`：**外部結合**．どちらかの表にある日付をすべて残す．
- `how="cross"`：**交差結合**．左右の行のすべての組合せを作る．この場合は`on`を指定せずに使う．

左結合・右結合・外部結合では，対応する値がない箇所は欠損値`NaN`になる．
```

期間・行数・欠損値・日付の間隔を確認する．

<!-- cell:inspect -->
```python
print("期間:", data["date"].min().date(), "〜", data["date"].max().date())
print("行数:", len(data))
print("欠損値の数:")
print(data.isna().sum().to_string())
intervals = data["date"].diff().dt.days.dropna()
print("日付の間隔 [日]:", sorted(intervals.unique().tolist()))
```

出力例：

```text
期間: 2019-01-01 〜 2019-12-31
行数: 365
欠損値の数:
date                0
water_level_m       0
inflow_m3s          0
outflow_m3s         0
precipitation_mm    0
日付の間隔 [日]: [1.0]
```

この年は365日分が日付順に対応している．日降水量は1日間の合計水深で，単位はmmである．以下では，各値を1日で割った降水強度として代表時刻に配置し，日と日の間を線形補間する．日内の雨の集中を調べる場合は，時間ごとの降水データを使って比較する．

第6回と同じ単位換算関数を用意し，時刻と観測量の配列を作る．

<!-- cell:arrays -->
```python
SECONDS_PER_DAY = 24 * 60 * 60

def m3s_to_1000m3_per_day(flow_m3s):
    return flow_m3s * SECONDS_PER_DAY / 1000

t_data = np.arange(len(data), dtype=float)  # 時刻 [日]（1月1日を0とする）
rain_obs = data["precipitation_mm"].values  # 降水強度 [mm/日]（日降水量を1日で割った値）
qin_obs = m3s_to_1000m3_per_day(data["inflow_m3s"].values)  # 観測流入量 [千m^3/日]
```

上段に降水量，下段にダムへの流入量を描く．

<!-- cell:rain_plot -->
```python
fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].bar(data["date"], rain_obs, color="tab:blue", width=1.0)
axes[0].set_ylabel("日降水量 [mm]")
axes[0].set_title(f"秩父の降水量と浦山ダムへの流入量（{year}年）")
axes[1].plot(data["date"], qin_obs, color="tab:blue")
axes[1].set_ylabel("流入量 [千m³/日]")
axes[1].set_xlabel("日付")
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "rain_inflow_2019.png", dpi=150)
plt.show()
```

![2019年の降水量と浦山ダムへの流入量](figs/08/rain_inflow_2019.png)

10月の大きい降水量に対応して，流入量も増えている．**雨水が流域内に貯まり，時間をかけて流れ出るメカニズム**をモデルに加える．

## 単一タンクモデルの構築

### モデルの仮定

集水域の貯留・流出を，一つの貯留量で近似する．このような貯留量と流出量の関係を表す線形貯留モデルは，降水から河川流量などを計算するソフトウェアHEC-HMSの[技術資料](https://www.hec.usace.army.mil/confluence/hmsdocs/hmstrm/baseflow/linear-reservoir-model)でも紹介されている．

```{tip} 仮定

- **雨水の入力**：流域全体に同じ雨が降り，そのうち一定の割合が貯留に寄与する．蒸発などを含む残りの分は，この期間の流出に寄与しないものとしてまとめる．
- **貯留からの流出**：流出量は貯留量に比例する．係数は対象期間を通じて一定とする．
- **観測との対応**：タンクから流れ出た水を，ダムへの流入量として比較する．
```

### 降水量から水量への換算

1 mmの雨が1 km²の面積に降ると，水量は次のようになる．

$$
10^{-3}\ \mathrm{m}\times10^6\ \mathrm{m^2}
=10^3\ \mathrm{m^3}=1\ \text{千}\mathrm{m^3}.
$$

したがって，集水面積（km²）と降水強度（mm/日）の数値の積は，流域に降る水量（千m³/日）になる．

集水面積を設定し，年合計の水量を確認する．

<!-- cell:volume -->
```python
AREA_KM2 = 51.6  # 集水面積 [km^2]
rain_volume = AREA_KM2 * rain_obs  # 流域への降水の水量 [千m^3/日]
print(f"年降水量: {rain_obs.sum():.1f} mm")
print(f"降水量から換算した年水量: {rain_volume.sum():.1f} 千m^3")
print(f"観測流入量の年水量: {qin_obs.sum():.1f} 千m^3")
```

出力例：

```text
年降水量: 1865.5 mm
降水量から換算した年水量: 96259.8 千m^3
観測流入量の年水量: 96083.7 千m^3
```

年水量は日ごとの観測値を1日分ずつ合計した値である．この比較には，観測地点の雨が集水域全体を代表するという近似が含まれる．

### 保存則と観測モデル

単一タンクの状態方程式と観測モデルは，次のとおりである．

$$
\frac{dS}{dt}=cAP(t)-kS(t),\qquad Q(t)=kS(t).
$$

- $t$ ：対象年の初日からの経過日数．
- $S(t)$ ：集水域の貯留量（千m³）．
- $P(t)$ ：補間した降水強度（mm/日）．
- $A$ ：集水面積（km²）．浦山ダムでは51.6 km²を使う．
- $c$ ：降水量のうちモデルの流出に寄与する割合．無次元で， $0\leq c\leq1$ とする．
- $k$ ：貯留量に対する流出量の比例係数（1/日）． $k>0$ とする．
- $Q(t)$ ：タンクからの流出量（千m³/日）．ダムへの流入量と比較する．

| 関係 | 入力から求める量 |
| --- | --- |
| 初期条件 | 初日の観測流入量 $Q_0$ と候補の $k$ から， $S(0)=Q_0/k$ を設定 |
| 保存則 | 初期貯留量と降水入力から，貯留量 $S(t)$ を計算 |
| 観測モデル | 貯留量から流出量 $Q(t)=kS(t)$ を計算 |
| データとの比較 | 計算流出量から観測流入量を引き，残差を計算 |

$Q_0$ は初日の観測値に固定する．初期貯留量は候補の $k$ ごとに設定し直すので，**独立に推定する係数は二つ**であり， $\theta=(c,k)$ と書く．

### 常微分方程式の数値解法

降水入力を補間し，保存則の右辺を返す関数を定義する．

<!-- cell:tank_rhs -->
```python
def tank_rhs(t, S, t_data, rain_data, c, k):
    rain_input = c * AREA_KM2 * np.interp(t, t_data, rain_data)
    return rain_input - k * S
```

係数と初日の流入量から初期貯留量を設定し，計算した貯留量を流出量へ換算する．

<!-- cell:simulate_tank -->
```python
def simulate_tank(theta, t_data, rain_data, q0):
    c, k = theta
    S0 = q0 / k
    sol = solve_ivp(
        tank_rhs, (t_data[0], t_data[-1]), [S0],
        t_eval=t_data, args=(t_data, rain_data, c, k),
        max_step=0.25, rtol=1e-7, atol=1e-5,
    )
    return k * sol.y[0]
```

```{dropdown} コードの補足：関数の引数と計算条件

| 引数 | 内容 |
| --- | --- |
| `theta` | 係数を`[c, k]`の順に並べた配列 |
| `t_data`・`rain_data` | 入力の時刻と降水強度の配列 |
| `q0` | 計算開始時の観測流入量 |

戻り値は，`t_data`と同じ長さの流出量の配列である．`max_step=0.25`は計算刻みの上限を0.25日にする．`rtol`・`atol`は数値積分の相対・絶対許容誤差を指定し，係数を少し変えたときの残差の変化も調べられるよう，計算誤差を抑える設定である．
```

(tank-recession)=
### 雨が止んだ後の減衰と時定数

雨水の入力が0なら，第2回の減衰モデルと同じ式になる．初期貯留量を $S_0$ とすると，

$$
S(t)=S_0e^{-kt},\qquad Q(t)=Q_0e^{-kt},\qquad Q_0=kS_0.
$$

- **時定数**：指数関数的な減衰の時間尺度．流出係数 $k$ の逆数 $\tau=1/k$ と定義し，単位は日である．
- **係数との対応**： $k$ が大きいほど時定数は短くなり，貯留量・流出量が速く減衰する．

ここで $\tau$ は一定の時間の長さを表す．計算開始からの経過時間 $t$ が $\tau$ に達した時点の流出量は，減衰式に $t=\tau=1/k$ を代入して求められる．

$$
Q(\tau)=Q_0e^{-k\tau}
=Q_0e^{-k(1/k)}
=Q_0e^{-1}
=\frac{Q_0}{e}.
$$

したがって，時定数は流出量が初期値の $1/e\approx0.368$ になるまでの時間でもある．この関係を使い，グラフでは初期流出量の $1/e$ の水平線との交点から時定数を確認する．

初日の流出量を100千m³/日，係数を0.2/日とし，30日間の無降雨の流出量を計算する．

<!-- cell:dry -->
```python
t_demo = np.arange(31, dtype=float)  # 時刻 [日]
rain_demo = np.zeros(len(t_demo))  # 降水強度 [mm/日]
q0_demo = 100.0  # 初日の流出量 [千m^3/日]
k_demo = 0.2  # 流出係数 [1/日]
q_demo = simulate_tank((0.7, k_demo), t_demo, rain_demo, q0_demo)
print(f"時定数: {1 / k_demo:.1f} 日")
print(f"5日後の流出量: {q_demo[5]:.2f} 千m^3/日")
```

- **コードの補足**：`np.zeros`は指定した長さの0の配列を作る．無降雨なので，係数`c`による雨水の入力は0である．

出力例：

```text
時定数: 5.0 日
5日後の流出量: 36.79 千m^3/日
```

**時定数をグラフから確認する**ため，横軸を経過日数，縦軸を計算した流出量として，雨が止んだ後の減衰を青い曲線で描く．さらに，初期流出量の $1/e$ に当たる約36.79千m³/日の位置に灰色の水平な破線を引く．曲線がこの水平線と交わる時刻が時定数であり，今回は5日になる．

<!-- cell:dry_plot -->
```python
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(t_demo, q_demo, color="tab:blue", label=f"k = {k_demo:.1f} /日")
ax.axhline(q0_demo / np.e, color="gray", linestyle="--", label="初期値の1/e")
ax.set_title("雨が止んだ後の流出量")
ax.set_xlabel("経過日数 [日]")
ax.set_ylabel("流出量 [千m³/日]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "tank_recession.png", dpi=150)
plt.show()
```

```{dropdown} コードの補足：減衰曲線と時定数の表示

- `ax.plot(t_demo, q_demo, ...)`：時刻の配列`t_demo`と，その時刻の流出量の配列`q_demo`を対応させて曲線を描く．
- `ax.axhline(q0_demo / np.e, ...)`：縦軸の値が`q0_demo / np.e`で一定の水平線を引く．`linestyle="--"`で破線にする．
- `np.e`：自然対数の底 $e\approx2.718$ を表す．`q0_demo / np.e`は初期流出量の $1/e$ を計算する．
```

![単一タンクの無降雨時の減衰](figs/08/tank_recession.png)

````{note} 演習1：流出係数と減衰の速さ

1. 初日の流出量は本文と同じ100千m³/日とし， $k=0.1$ と $k=0.5$ の二つを比べる．次の【】を埋め，本文の描画にもう1本の曲線を加えて，<span style="color:red">比較図をNotebookに出力せよ</span>．

本文と同じ無降雨の入力を使い，二つの係数の流出量を準備する．

```python
q_slow = 【k=0.1として流出量を求める関数呼び出し】
q_fast = 【k=0.5として流出量を求める関数呼び出し】
```

2. 図と時定数の式を使い，<span style="color:red">減衰が速い係数とその時定数をREADMEに記せ</span>．
````

````{hidden-answer} 演習1の解答例

**1．流出係数による比較図**

初日の流出量をそろえ，係数だけを変更する．初期貯留量は関数内で各係数に合わせて設定される．

<!-- cell:answer1_calc -->
```python
q_slow = simulate_tank((0.7, 0.1), t_demo, rain_demo, q0_demo)
q_fast = simulate_tank((0.7, 0.5), t_demo, rain_demo, q0_demo)
```

本文の描画に2本の流出量を指定する．

<!-- cell:answer1_plot -->
```{code-block} python
:linenos:
:emphasize-lines: 2-3
:class: code-focus

fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(t_demo, q_slow, color="tab:blue", label="k = 0.1 /日")
ax.plot(t_demo, q_fast, color="tab:orange", label="k = 0.5 /日")
ax.axhline(q0_demo / np.e, color="gray", linestyle="--", label="初期値の1/e")
ax.set_title("雨が止んだ後の流出量")
ax.set_xlabel("経過日数 [日]")
ax.set_ylabel("流出量 [千m³/日]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "exercise1_recession.png", dpi=150)
plt.show()
```

![同じ初日流量から減衰する二つの流出係数](figs/08/exercise1_recession.png)

**2．減衰が速い係数と時定数**

$k=0.5$ /日の方が速く減衰し，時定数は $1/0.5=2$ 日である． $k=0.1$ /日の時定数は10日である．
````

## 単一タンクのパラメタ推定

(tank-fit)=
### 残差関数と推定対象の期間

第7回と同じ最小二乗法を使う． $i=0,\ldots,n-1$ を観測点の番号， $t_i$ を経過日数， $q_i$ を観測流入量とし，残差を $e_i(\theta)=Q(t_i;\theta)-q_i$ とする．

モデルは初日から計算し，**推定に使う日の残差だけを取り出す**．これにより，後で推定期間を変えても初期条件の扱いをそろえられる．

残差関数を定義する．

<!-- cell:residuals -->
```python
def residuals_tank(theta, t_data, rain_data, qin_data, fit_mask):
    q_model = simulate_tank(theta, t_data, rain_data, qin_data[0])
    return (q_model - qin_data)[fit_mask]
```

- **コードの補足**：`fit_mask`は推定に使う日を`True`とする真偽値の配列である．

2019年の全日を推定対象とし，係数の開始値と範囲を設定する．

<!-- cell:fit_setup -->
```python
fit_mask = np.ones(len(t_data), dtype=bool)
theta_initial = [0.7, 0.3]  # c，k [1/日]
bounds_tank = ([0.0, 0.001], [1.0, 5.0])
```

- **コードの補足**：`np.ones(..., dtype=bool)`はすべて`True`の配列を作る．`k`の範囲は，この比較で探索する0.001〜5/日とする．

残差二乗和を小さくする係数を求める．

<!-- cell:fit -->
```python
result_tank = least_squares(
    residuals_tank, theta_initial,
    args=(t_data, rain_obs, qin_obs, fit_mask),
    bounds=bounds_tank, diff_step=0.01,
)
c_hat, k_hat = result_tank.x
q_tank = simulate_tank(result_tank.x, t_data, rain_obs, qin_obs[0])
residual_tank = q_tank - qin_obs
rmse_tank = np.sqrt(np.mean(residual_tank[fit_mask] ** 2))
```

- **コードの補足**：`diff_step=0.01`は，数値微分で候補の係数を約1%動かし，残差の変化を調べる指定である．以下の推定でも同じ設定を使う．

推定値の末尾や停止理由は実行環境によって異なる場合がある．停止結果，係数，時定数，RMSEを確認する．

<!-- cell:fit_report -->
```python
print("停止結果:", result_tank.success, result_tank.message)
print(f"c = {c_hat:.3f}，k = {k_hat:.3f} /日，時定数 = {1 / k_hat:.3f} 日")
print(f"2019年の当てはまりのRMSE: {rmse_tank:.1f} 千m^3/日")
```

出力例：

```text
停止結果: True `xtol` termination condition is satisfied.
c = 0.867，k = 2.824 /日，時定数 = 0.354 日
2019年の当てはまりのRMSE: 309.0 千m^3/日
```

2019年の全日で推定した係数を保存する．この後の演習で推定期間を変更しても，本文の比較には保存した係数を使う．

<!-- cell:save_single -->
```python
theta_reference = result_tank.x.copy()
```

```{tip} 時定数と日データの関係

時定数が1日より短い値となる場合，モデルは日と日の間の速い応答も計算している．その時間内の流出過程を現実のものとして解釈するには，時間ごとの雨量・流量との照合が必要になる．今回は日単位の当てはまりを評価する．
```

(tank-plot)=
### 流入量と残差の比較

上段に観測流入量とモデルの流出量，下段に残差を描く．

<!-- cell:single_plot -->
```python
fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].plot(data["date"], qin_obs, color="black", label="観測流入量")
axes[0].plot(data["date"], q_tank, color="tab:blue", label="単一タンク")
axes[0].set_title(f"単一タンクによる流入量の再現（{year}年）")
axes[0].set_ylabel("流量 [千m³/日]")
axes[0].legend()
axes[1].plot(data["date"], residual_tank, color="tab:blue")
axes[1].axhline(0, color="black", linewidth=0.8)
axes[1].set_ylabel("計算流量−観測流量 [千m³/日]")
axes[1].set_xlabel("日付")
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "single_tank_2019.png", dpi=150)
plt.show()
```

![単一タンクによる2019年の流入量と残差](figs/08/single_tank_2019.png)

残差が大きい時期を確認する．RMSEは残差を二乗して求めるため，大きい出水時のずれが係数の推定に強く影響する．推定期間の変更による違いを，次の演習で比べる．

係数の探索とあわせて，観測した雨が流域をどの程度代表するか，単一の時定数で流出を表せるかを検討する．

````{note} 演習2：推定期間と未使用期間の誤差

1. 2019年1〜9月の流入量だけで単一タンクの係数を推定し，10〜12月へ同じ係数を適用する．本文の推定・誤差計算を変更し，<span style="color:red">期間ごとのRMSEをNotebookに出力せよ</span>．

期間を選び，本文と同じ開始値・範囲で推定する．

```python
train_mask = 【2019年9月30日までを選ぶ条件】
valid_mask = 【2019年10月1日以降を選ぶ条件】
fit_mask = 【推定に使う期間のマスク】
result_tank = least_squares(【本文と同じ開始値・範囲で推定するための引数】)
c_hat, k_hat = result_tank.x
q_tank = 【推定した係数で初日から全期間を計算する関数呼び出し】
residual_tank = 【全期間の流量の残差】
rmse_train = 【訓練期間のRMSE】
rmse_valid = 【検証期間のRMSE】
```

2. 本文の流入量・残差の描画を使い，検証期間に背景色を付け，<span style="color:red">図をNotebookに出力せよ</span>．背景表示は第7回の`axvspan`を使い，開始日を`data["date"][valid_mask].min()`，終了日を`data["date"].max()`で求めよ．
````

````{hidden-answer} 演習2の解答例

**1．期間ごとのRMSE**

残差関数が取り出す日だけを変更する．計算自体は1月1日から継続する．

<!-- cell:answer2_calc -->
```{code-block} python
:linenos:
:emphasize-lines: 1-3
:class: code-focus

train_mask = data["date"] <= "2019-09-30"
valid_mask = data["date"] >= "2019-10-01"
fit_mask = train_mask
result_tank = least_squares(
    residuals_tank, theta_initial,
    args=(t_data, rain_obs, qin_obs, fit_mask),
    bounds=bounds_tank, diff_step=0.01,
)
c_hat, k_hat = result_tank.x
q_tank = simulate_tank(result_tank.x, t_data, rain_obs, qin_obs[0])
residual_tank = q_tank - qin_obs
rmse_train = np.sqrt(np.mean(residual_tank[train_mask] ** 2))
rmse_valid = np.sqrt(np.mean(residual_tank[valid_mask] ** 2))
```

係数と，推定に使った期間・未使用期間の誤差を表示する．

<!-- cell:answer2_report -->
```python
print(f"c = {c_hat:.3f}，k = {k_hat:.3f} /日")
print(f"訓練期間のRMSE: {rmse_train:.1f} 千m^3/日")
print(f"検証期間のRMSE: {rmse_valid:.1f} 千m^3/日")
```

出力例：

```text
c = 0.618，k = 0.704 /日
訓練期間のRMSE: 161.5 千m^3/日
検証期間のRMSE: 1334.7 千m^3/日
```

**2．流入量と残差の図**

本文の描画に，検証期間の背景を加える．

<!-- cell:answer2_plot -->
```{code-block} python
:linenos:
:emphasize-lines: 6,10
:class: code-focus

fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].plot(data["date"], qin_obs, color="black", label="観測流入量")
axes[0].plot(data["date"], q_tank, color="tab:blue", label="単一タンク")
axes[0].set_title(f"単一タンクによる流入量の再現（{year}年）")
axes[0].set_ylabel("流量 [千m³/日]")
axes[0].axvspan(data["date"][valid_mask].min(), data["date"].max(), color="gray", alpha=0.15, label="検証期間")
axes[0].legend()
axes[1].plot(data["date"], residual_tank, color="tab:blue")
axes[1].axhline(0, color="black", linewidth=0.8)
axes[1].axvspan(data["date"][valid_mask].min(), data["date"].max(), color="gray", alpha=0.15)
axes[1].set_ylabel("計算流量−観測流量 [千m³/日]")
axes[1].set_xlabel("日付")
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "exercise2_validation.png", dpi=150)
plt.show()
```

![9月までで推定した単一タンクの検証期間への適用](figs/08/exercise2_validation.png)

推定に使う期間を変えると，係数と未使用期間への適用結果が変わる．誤差を評価した期間を添えて結果を比較する．
````

## 並列2タンクへの発展

### 二つの貯留と流出の仮定

**同じ雨でも，水が通る経路によって川に届くまでの時間が異なる**．例えば山地に雨が降ると，次のような流れが同時に生じる．

- **速い流出**：地表や浅い土壌を通って比較的短時間で川に集まる．降雨に伴う流量の急な増加と，その後の速い減衰に対応する．
- **遅い流出**：地中に浸透して蓄えられた水が，時間をかけて川へ流れ出る．雨がやんだ後も続く流れに対応する．地下水が無降雨時の河川流量を支える過程は，地質や水資源を調査する米国地質調査所（USGS）の[浸透と水循環の解説](https://www.usgs.gov/water-science-school/science/infiltration-and-water-cycle)でも説明されている．

この二つの応答を，**流域内の貯留を二つに分けて同時に計算するモデル**で近似する．各タンクは水を蓄えて流し出す過程をまとめたものであり，実際の土壌や地下水との対応は，地質・地下水位などの資料と照合して検討する．単一タンクの一つの時定数を，異なる二つの時定数へ拡張する．

保存則と観測モデルは次のようになる．

$$
\begin{aligned}
\frac{dS_1}{dt}&=fcAP(t)-k_1S_1,\\
\frac{dS_2}{dt}&=(1-f)cAP(t)-k_2S_2,\\
Q(t)&=k_1S_1(t)+k_2S_2(t).
\end{aligned}
$$

- $S_1(t),S_2(t)$ ：第1・第2タンクの貯留量（千m³）．
- $k_1,k_2$ ：それぞれの流出係数（1/日）．どちらも正とする．
- $f$ ：雨水の入力を第1タンクに分ける割合．第2には $1-f$ を与え， $0\leq f\leq1$ とする．
- $c,A,P(t),Q_0$ ：単一タンクと同じ意味・値を使う．

初日の流出量も割合 $f$ と $1-f$ で分ける仮定を置き，初期条件を

$$
S_1(0)=\frac{fQ_0}{k_1},\qquad S_2(0)=\frac{(1-f)Q_0}{k_2}
$$

とする．このとき $Q(0)=Q_0$ である．推定する係数は $\theta_2=(c,k_1,k_2,f)$ の四つになる．

**係数が大きい側ほど速く減衰する**．第1・第2は番号で区別し，推定後に $1/k_1$ と $1/k_2$ を比較する．

例えば $k_1>k_2$ なら，第1タンクを速い流出，第2タンクを遅い流出に対応させて解釈できる．同じ降雨からの入力を割合 $f$ と $1-f$ で二つの経路へ分け，それぞれの流出を合流させるため，**並列配置**と呼ぶ．

各微分方程式は，共通の降雨入力とそれぞれ自身の貯留量から変化率を求める．このモデルではタンク間の水の移動を仮定せず，二つの貯留量の時間変化を並行して解き，合計流出量を観測流量と比較する．

二つのタンクへの入力と，合計流出量の関係を図で示す．

```{mermaid}
flowchart TD
    R["雨水の入力 $$cAP(t)$$"] -->|"割合 $$f$$"| T1["<div><div>第1タンク</div><div>$$S_1(t)$$</div></div>"]
    R -->|"割合 $$1-f$$"| T2["<div><div>第2タンク</div><div>$$S_2(t)$$</div></div>"]
    T1 -->|"流出量 $$k_1 S_1(t)$$"| Q["<div><div>観測モデル</div><div>$$Q(t)=k_1 S_1(t)+k_2 S_2(t)$$</div></div>"]
    T2 -->|"流出量 $$k_2 S_2(t)$$"| Q
    Q --> D["ダムへの観測流入量と比較"]
    classDef first fill:#eaf2fb,stroke:#32689a,color:#172b3a;
    classDef second fill:#fff0de,stroke:#b66a20,color:#4a2b10;
    classDef data fill:#f5f5f5,stroke:#777,color:#222;
    class T1 first;
    class T2 second;
    class R,Q,D data;
```

### 連立微分方程式の実装

`solve_ivp`の状態変数を二つに増やす．

| 指定・戻り値 | 単一タンク | 並列2タンク |
| --- | --- | --- |
| 初期条件 | `[S0]` | `[S10, S20]` |
| 右辺の戻り値 | 貯留量一つの変化率 | `[第1の変化率, 第2の変化率]` |
| 数値解 | `sol.y[0]` | `sol.y[0]`と`sol.y[1]` |
| 観測モデル | `k * sol.y[0]` | `k1 * sol.y[0] + k2 * sol.y[1]` |

````{note} 演習3：並列2タンクの関数の実装

1. 単一タンクの`tank_rhs`と上の連立方程式を参考に【】を埋め，<span style="color:red">関数`tank2_rhs`をNotebookに定義せよ</span>．

二つの状態変数の変化率を，第1・第2タンクの順に並べたリストで返す．

```python
def tank2_rhs(t, S, t_data, rain_data, c, k1, k2, f):
    S1, S2 = S
    rain_input = c * AREA_KM2 * np.interp(t, t_data, rain_data)
    return 【第1・第2タンクの変化率を順に並べたリスト】
```

- **コードの補足**：状態の配列`S`を`S1, S2`に分け，微分方程式と同じ順に二つの変化率を返す．

定義後，無降雨で貯留量が120千m³と400千m³の場合の変化率を確認せよ．`t_demo`と`rain_demo`は，単一タンクの無降雨時の計算で用意した配列を使う．

```python
rates_demo = tank2_rhs(0.0, [120.0, 400.0], t_demo, rain_demo, 0.7, 0.5, 0.1, 0.6)
print(f"第1タンクの変化率: {rates_demo[0]:.1f} 千m^3/日")
print(f"第2タンクの変化率: {rates_demo[1]:.1f} 千m^3/日")
```

2. 単一タンクの`simulate_tank`と並列2タンクの初期条件・観測モデルを参考に【】を埋め，<span style="color:red">関数`simulate_tank2`をNotebookに定義せよ</span>．

初日の観測流量を二つに分け，貯留量から合計流出量を求める．

```python
def simulate_tank2(theta, t_data, rain_data, q0):
    c, k1, k2, f = theta
    S10 = 【第1タンクの初期貯留量】
    S20 = 【第2タンクの初期貯留量】
    sol = solve_ivp(
        tank2_rhs, (t_data[0], t_data[-1]), 【初期貯留量を第1・第2の順に並べたリスト】,
        t_eval=t_data, args=(t_data, rain_data, c, k1, k2, f),
        max_step=0.25, rtol=1e-7, atol=1e-5,
    )
    return 【二つのタンクからの流出量を合計する式】
```

定義後，本文と同じ無降雨の入力で実行し，初日の合計流出量が`q0_demo`と一致することを確認せよ．

```python
q2_demo = simulate_tank2((0.7, 0.5, 0.1, 0.6), t_demo, rain_demo, q0_demo)
print(f"初日の合計流出量: {q2_demo[0]:.2f} 千m^3/日")
print(f"5日後の合計流出量: {q2_demo[5]:.2f} 千m^3/日")
```
````

````{hidden-answer} 演習3の解答例

**1．二つの貯留量の変化率**

各タンクの変化率は，分配された雨水の入力から，そのタンクの流出量を引いて求める．

<!-- cell:tank2_rhs -->
```{code-block} python
:linenos:
:emphasize-lines: 2,4
:class: code-focus

def tank2_rhs(t, S, t_data, rain_data, c, k1, k2, f):
    S1, S2 = S
    rain_input = c * AREA_KM2 * np.interp(t, t_data, rain_data)
    return [f * rain_input - k1 * S1, (1 - f) * rain_input - k2 * S2]
```

無降雨では入力が0になるので，それぞれの貯留量は流出量の分だけ減る．設問の値で変化率を確認する．

<!-- cell:answer3_rhs_check -->
```python
rates_demo = tank2_rhs(0.0, [120.0, 400.0], t_demo, rain_demo, 0.7, 0.5, 0.1, 0.6)
print(f"第1タンクの変化率: {rates_demo[0]:.1f} 千m^3/日")
print(f"第2タンクの変化率: {rates_demo[1]:.1f} 千m^3/日")
```

出力例：

```text
第1タンクの変化率: -60.0 千m^3/日
第2タンクの変化率: -40.0 千m^3/日
```

**2．貯留量から合計流出量への換算**

初日の流出量を割合`f`と`1 - f`で分け，それぞれを流出係数で割って初期貯留量を求める．計算後は，二つの貯留量から得られる流出量を足し合わせる．

<!-- cell:simulate_tank2 -->
```{code-block} python
:linenos:
:emphasize-lines: 3-4,6-7,10
:class: code-focus

def simulate_tank2(theta, t_data, rain_data, q0):
    c, k1, k2, f = theta
    S10 = f * q0 / k1
    S20 = (1 - f) * q0 / k2
    sol = solve_ivp(
        tank2_rhs, (t_data[0], t_data[-1]), [S10, S20],
        t_eval=t_data, args=(t_data, rain_data, c, k1, k2, f),
        max_step=0.25, rtol=1e-7, atol=1e-5,
    )
    return k1 * sol.y[0] + k2 * sol.y[1]
```

本文で用意した無降雨の入力を与え，合計流出量を確認する．

<!-- cell:answer3_flow_check -->
```python
q2_demo = simulate_tank2((0.7, 0.5, 0.1, 0.6), t_demo, rain_demo, q0_demo)
print(f"初日の合計流出量: {q2_demo[0]:.2f} 千m^3/日")
print(f"5日後の合計流出量: {q2_demo[5]:.2f} 千m^3/日")
```

出力例：

```text
初日の合計流出量: 100.00 千m^3/日
5日後の合計流出量: 29.19 千m^3/日
```

初日の合計は $k_1S_1(0)+k_2S_2(0)=fQ_0+(1-f)Q_0=Q_0$ となり，指定した初期流量に一致する．
````

単一タンクと同じ期間の残差を取り出す関数を定義する．

<!-- cell:residuals2 -->
```python
def residuals_tank2(theta, t_data, rain_data, qin_data, fit_mask):
    q_model = simulate_tank2(theta, t_data, rain_data, qin_data[0])
    return (q_model - qin_data)[fit_mask]
```

(tank-two-fit)=
### 同じデータによる推定と探索初期値の確認

2019年の全日を使い，三つの探索初期値で推定する． $c$ と $f$ は0〜1，二つの流出係数は単一タンクと同じ0.001〜5/日を探索する．

推定対象と範囲，初期値の候補を設定する．

<!-- cell:fit2_setup -->
```python
fit_mask = np.ones(len(t_data), dtype=bool)
bounds_tank2 = ([0.0, 0.001, 0.001, 0.0], [1.0, 5.0, 5.0, 1.0])
initial_guesses_2 = [
    [0.7, 0.8, 0.03, 0.5],
    [0.5, 1.5, 0.1, 0.7],
    [0.9, 0.2, 0.02, 0.3],
]
```

第7回と同じく開始値ごとに推定し，この三つの中でcostが最も小さい結果を保存する．

<!-- cell:fit2 -->
```python
fit_rows = []
best_cost = np.inf
for guess in initial_guesses_2:
    res2 = least_squares(
        residuals_tank2, guess,
        args=(t_data, rain_obs, qin_obs, fit_mask),
        bounds=bounds_tank2, diff_step=0.01,
    )
    c2, k12, k22, f2 = res2.x
    rmse2 = np.sqrt(np.mean(res2.fun ** 2))
    fit_rows.append([c2, k12, k22, f2, rmse2, res2.success])
    if res2.cost < best_cost:
        best_cost = res2.cost
        result_tank2 = res2
fit_table = pd.DataFrame(fit_rows, columns=["c", "k1", "k2", "f", "RMSE [千m³/日]", "停止条件"])
print(fit_table.round(3).to_string(index=False))
```

```{dropdown} コードの補足：結果の比較と保存

- `pd.DataFrame(行のリスト, columns=列名)`で，計算結果の比較表を作る．`round(3)`は表示を小数第3位にそろえる．`to_string(index=False)`で行番号を省いた表を表示する．
- `np.inf`は正の無限大で，最初のcostより大きい比較用の値になる．
- `if res2.cost < best_cost`を満たした結果で保存先を更新し，試した候補の中で最も小さいcostの結果を残す．
```

出力例：

```text
  c    k1    k2     f  RMSE [千m³/日]  停止条件
1.0 4.227 0.404 0.671       277.055  True
1.0 4.232 0.406 0.671       277.056  True
1.0 4.213 0.402 0.672       277.056  True
```

保存した係数から流出量と残差を計算する．単一タンクも全日で推定した本文の結果を使う．

<!-- cell:two_compare -->
```python
q_tank = simulate_tank(theta_reference, t_data, rain_obs, qin_obs[0])
residual_tank = q_tank - qin_obs
rmse_tank = np.sqrt(np.mean(residual_tank ** 2))
c2_hat, k1_hat, k2_hat, f_hat = result_tank2.x
q_tank2 = simulate_tank2(result_tank2.x, t_data, rain_obs, qin_obs[0])
residual_tank2 = q_tank2 - qin_obs
rmse_tank2 = np.sqrt(np.mean(residual_tank2 ** 2))
print(f"時定数: 第1 = {1 / k1_hat:.3f} 日，第2 = {1 / k2_hat:.3f} 日")
print(f"単一タンクのRMSE: {rmse_tank:.1f} 千m^3/日")
print(f"並列2タンクのRMSE: {rmse_tank2:.1f} 千m^3/日")
```

出力例：

```text
時定数: 第1 = 0.237 日，第2 = 2.473 日
単一タンクのRMSE: 309.0 千m^3/日
並列2タンクのRMSE: 277.1 千m^3/日
```

二つのモデルの流入量と残差を，同じ軸で比較する．

<!-- cell:compare_plot -->
```python
fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].plot(data["date"], qin_obs, color="black", label="観測流入量")
axes[0].plot(data["date"], q_tank, color="tab:blue", label="単一タンク")
axes[0].plot(data["date"], q_tank2, color="tab:orange", label="並列2タンク")
axes[0].set_title(f"単一タンクと並列2タンクの比較（{year}年）")
axes[0].set_ylabel("流量 [千m³/日]")
axes[0].legend()
axes[1].plot(data["date"], residual_tank, color="tab:blue", label="単一タンク")
axes[1].plot(data["date"], residual_tank2, color="tab:orange", label="並列2タンク")
axes[1].axhline(0, color="black", linewidth=0.8)
axes[1].set_ylabel("計算流量−観測流量 [千m³/日]")
axes[1].set_xlabel("日付")
axes[1].legend()
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "one_vs_two_2019.png", dpi=150)
plt.show()
```

![二つのタンクモデルの当てはまりと残差](figs/08/one_vs_two_2019.png)

**二つの時定数を導入した結果，この年の当てはまりが改善した**．推定した割合`c`が上限1に近い場合は，探索範囲と併せて報告する．係数の解釈には，雨量の代表性や時間分解能の近似も含まれる．

````{note} 演習4：タンクの番号と推定値の解釈

1. 推定値の $k_1$ と $k_2$ を交換し， $f$ を $1-f$ に変える．本文の`simulate_tank2`を再利用し，<span style="color:red">流出量の最大差をNotebookに出力せよ</span>．

番号を入れ替えた係数で流出量を計算する．

```python
theta_swapped = 【cは同じで，k1・k2を交換し，fを1-fにした係数の組】
q_swapped = 【番号を入れ替えた係数で流出量を計算する関数呼び出し】
max_difference = 【q_swappedとq_tank2の差の絶対値の最大値】
print(f"番号を入れ替えた流出量の最大差: {max_difference:.4f} 千m^3/日")
```

2. 第1・第2の時定数を比べ，<span style="color:red">速い応答と遅い応答の時定数をREADMEに記せ</span>．
````

````{hidden-answer} 演習4の解答例

**1．番号を入れ替えた流出量の最大差**

雨水と初日の流量の分け方も交換するため，二つのタンクの役割が入れ替わり，合計流出量は同じになる．数値計算では積分誤差の範囲で差が生じることがある．

<!-- cell:answer4 -->
```{code-block} python
:linenos:
:emphasize-lines: 1
:class: code-focus

theta_swapped = (c2_hat, k2_hat, k1_hat, 1 - f_hat)
q_swapped = simulate_tank2(theta_swapped, t_data, rain_obs, qin_obs[0])
max_difference = np.max(np.abs(q_swapped - q_tank2))
print(f"番号を入れ替えた流出量の最大差: {max_difference:.4f} 千m^3/日")
```

出力例：

```text
番号を入れ替えた流出量の最大差: 0.0000 千m^3/日
```

**2．速い応答と遅い応答の時定数**

速い応答の時定数は約0.237日，遅い応答の時定数は約2.473日である．

係数の配列の番号に加え，時定数で流出の速さを説明すると，別の開始値で得た結果とも対応させやすい．
````

## 未使用の年への適用

(tank-transfer)=
### 係数の保存と2020年の入力

第7回と同じく，推定した係数を保存して対象期間を切り替える．**2019年の係数を固定し，2020年の観測降水量から流入量を計算する**．初日の観測流入量で初期条件を設定する．

並列2タンクの係数も保存する．単一タンクには，演習2の前に保存した`theta_reference`を使う．

<!-- cell:reference -->
```python
theta2_reference = result_tank2.x.copy()
```

- **コードの補足**：`copy()`で係数の配列のコピーを保存する．以下で再推定しても，参照する係数を保てる．

2020年のデータを取り出し，同じ単位に換算する．

<!-- cell:valid_prepare -->
```python
valid_year = 2020
dam_valid = dam[dam["date"].dt.year == valid_year].reset_index(drop=True)
rain_valid = rain[rain["date"].dt.year == valid_year].reset_index(drop=True)
data_valid = pd.merge(dam_valid, rain_valid, on="date", how="inner")
t_valid = np.arange(len(data_valid), dtype=float)  # 時刻 [日]（対象年の初日を0とする）
p_valid = data_valid["precipitation_mm"].values  # 降水強度 [mm/日]
q_valid = m3s_to_1000m3_per_day(data_valid["inflow_m3s"].values)  # 観測流入量 [千m^3/日]
```

固定した係数で流出量を計算し，2020年の観測流入量とのRMSEを求める．

<!-- cell:valid_calc -->
```python
q_fixed = simulate_tank(theta_reference, t_valid, p_valid, q_valid[0])
q2_fixed = simulate_tank2(theta2_reference, t_valid, p_valid, q_valid[0])
rmse_fixed = np.sqrt(np.mean((q_fixed - q_valid) ** 2))
rmse2_fixed = np.sqrt(np.mean((q2_fixed - q_valid) ** 2))
comparison = pd.DataFrame({
    "モデル": ["単一タンク", "並列2タンク"],
    "係数の個数": [2, 4],
    "2019年のRMSE": [rmse_tank, rmse_tank2],
    "2020年のRMSE": [rmse_fixed, rmse2_fixed],
})
print(comparison.round(1).to_string(index=False))
```

表のRMSEの単位は千m³/日である．2019年は推定に使った期間，2020年は係数を固定して適用した期間である．

出力例：

```text
   モデル  係数の個数  2019年のRMSE  2020年のRMSE
 単一タンク      2       309.0       335.5
並列2タンク      4       277.1       316.7
```

2020年の流入量と残差を二つのモデルで比較する．

<!-- cell:valid_plot -->
```python
fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].plot(data_valid["date"], q_valid, color="black", label="観測流入量")
axes[0].plot(data_valid["date"], q_fixed, color="tab:blue", label="単一タンク")
axes[0].plot(data_valid["date"], q2_fixed, color="tab:orange", label="並列2タンク")
axes[0].set_title(f"単一タンクと並列2タンクの比較（{valid_year}年）")
axes[0].set_ylabel("流量 [千m³/日]")
axes[0].legend()
axes[1].plot(data_valid["date"], (q_fixed - q_valid), color="tab:blue", label="単一タンク")
axes[1].plot(data_valid["date"], (q2_fixed - q_valid), color="tab:orange", label="並列2タンク")
axes[1].axhline(0, color="black", linewidth=0.8)
axes[1].set_ylabel("計算流量−観測流量 [千m³/日]")
axes[1].set_xlabel("日付")
axes[1].legend()
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "transfer_2020.png", dpi=150)
plt.show()
```

![2019年の係数を2020年へ適用した二つのモデル](figs/08/transfer_2020.png)

この比較で評価したのは，**観測降水量と初日の流量を与えたときの，係数の別年への適用結果**である．将来への予測に利用する場合は，降水量を予報値として与えた結果や，初期状態の推定方法も評価する．

## まとめ

- **流量の式を仮定する**：保存則に $Q=kS$ を組み合わせ，降水量からダムへの流入量を計算する．
- **時定数で応答を説明する**： $1/k$ が短いほど速く減衰する．並列2タンクでは，異なる二つの応答を合計する．
- **同じ条件でモデルを評価する**：当てはまり，固定係数での未使用データへの適用，係数の意味を合わせて確認する．

次回は周期的な外部入力を時間の関数で表し，周期に対応する変化と，応答の遅れを調べる．

## 課題

````{warning} 課題1：前半で推定したモデルの後半への適用

2019年1〜6月で単一タンクと並列2タンクを推定し，7〜12月の観測流入量で結果を比較する．本文の2019年のデータと関数を使う．

1. 次の【】を埋め，本文の二つのモデルの推定を，前半の流入量だけを使う計算へ変更する．<span style="color:red">両期間のRMSEの比較表をNotebookに出力せよ</span>．

本文と同じ初期条件・探索範囲を使い，残差を取り出す期間を変更する．

```python
train_mask = 【2019年6月30日までを選ぶ条件】
valid_mask = 【2019年7月1日以降を選ぶ条件】
fit_mask = 【推定に使う期間のマスク】
result_tank = least_squares(【単一タンクを前半のデータで推定するための引数】)
q_tank = 【推定した単一タンクで全期間を計算する関数呼び出し】
residual_tank = 【単一タンクの残差】
```

`fit_mask = train_mask`を保ち，本文の`initial_guesses_2`と`for`文をコピーして並列2タンクを推定する．結果は`result_tank2`に保存する．二つのモデルの計算結果から誤差を求めよ．

```python
q_tank2 = 【推定した並列2タンクで全期間を計算する関数呼び出し】
residual_tank2 = 【並列2タンクの残差】
rmse_train = 【単一タンクの訓練期間のRMSE】
rmse_valid = 【単一タンクの検証期間のRMSE】
rmse2_train = 【並列2タンクの訓練期間のRMSE】
rmse2_valid = 【並列2タンクの検証期間のRMSE】
```

表の列名・表示方法は，本文の`pd.DataFrame`の比較表を参考にせよ．

2. 本文の二つのモデルの流入量・残差の描画をコピーし，演習2と同じ方法で後半に背景色を付け，<span style="color:red">比較図をNotebookに出力せよ</span>．
3. 検証期間のRMSEを根拠に，<span style="color:red">後半をよりよく再現したモデルをREADMEに2〜3文で記せ</span>．
````

````{hidden-answer} 課題1の解答例

**1．前半での推定と後半のRMSE**

本文と同じ初日から計算し，前半の残差だけで係数を選ぶ．

<!-- cell:homework1_single -->
```{code-block} python
:linenos:
:emphasize-lines: 1-3
:class: code-focus

train_mask = data["date"] <= "2019-06-30"
valid_mask = data["date"] >= "2019-07-01"
fit_mask = train_mask
result_tank = least_squares(
    residuals_tank, theta_initial,
    args=(t_data, rain_obs, qin_obs, fit_mask),
    bounds=bounds_tank, diff_step=0.01,
)
c_hat, k_hat = result_tank.x
q_tank = simulate_tank(result_tank.x, t_data, rain_obs, qin_obs[0])
residual_tank = q_tank - qin_obs
rmse_train = np.sqrt(np.mean(residual_tank[train_mask] ** 2))
rmse_valid = np.sqrt(np.mean(residual_tank[valid_mask] ** 2))
```

本文の並列2タンクの探索を，同じ`fit_mask`で実行する．

<!-- cell:homework1_two -->
```python
fit_rows = []
best_cost = np.inf
for guess in initial_guesses_2:
    res2 = least_squares(
        residuals_tank2, guess,
        args=(t_data, rain_obs, qin_obs, fit_mask),
        bounds=bounds_tank2, diff_step=0.01,
    )
    c2, k12, k22, f2 = res2.x
    rmse2 = np.sqrt(np.mean(res2.fun ** 2))
    fit_rows.append([c2, k12, k22, f2, rmse2, res2.success])
    if res2.cost < best_cost:
        best_cost = res2.cost
        result_tank2 = res2
fit_table = pd.DataFrame(fit_rows, columns=["c", "k1", "k2", "f", "RMSE [千m³/日]", "停止条件"])
print(fit_table.round(3).to_string(index=False))
```

二つのモデルについて，訓練・検証期間の誤差を同じ表で表示する．

<!-- cell:homework1_report -->
```python
q_tank2 = simulate_tank2(result_tank2.x, t_data, rain_obs, qin_obs[0])
residual_tank2 = q_tank2 - qin_obs
rmse2_train = np.sqrt(np.mean(residual_tank2[train_mask] ** 2))
rmse2_valid = np.sqrt(np.mean(residual_tank2[valid_mask] ** 2))
halfyear_table = pd.DataFrame({
    "モデル": ["単一タンク", "並列2タンク"],
    "訓練期間のRMSE": [rmse_train, rmse2_train],
    "検証期間のRMSE": [rmse_valid, rmse2_valid],
})
print(halfyear_table.round(1).to_string(index=False))
```

RMSEの単位は千m³/日である．

出力例：

```text
   モデル  訓練期間のRMSE  検証期間のRMSE
 単一タンク       41.9     1328.2
並列2タンク       24.3     1183.4
```

**2．流入量と残差の比較図**

本文の描画に，7〜12月の背景表示を加える．

<!-- cell:homework1_plot -->
```{code-block} python
:linenos:
:emphasize-lines: 7,12
:class: code-focus

fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].plot(data["date"], qin_obs, color="black", label="観測流入量")
axes[0].plot(data["date"], q_tank, color="tab:blue", label="単一タンク")
axes[0].plot(data["date"], q_tank2, color="tab:orange", label="並列2タンク")
axes[0].set_title(f"単一タンクと並列2タンクの比較（{year}年）")
axes[0].set_ylabel("流量 [千m³/日]")
axes[0].axvspan(data["date"][valid_mask].min(), data["date"].max(), color="gray", alpha=0.15, label="検証期間")
axes[0].legend()
axes[1].plot(data["date"], residual_tank, color="tab:blue", label="単一タンク")
axes[1].plot(data["date"], residual_tank2, color="tab:orange", label="並列2タンク")
axes[1].axhline(0, color="black", linewidth=0.8)
axes[1].axvspan(data["date"][valid_mask].min(), data["date"].max(), color="gray", alpha=0.15)
axes[1].set_ylabel("計算流量−観測流量 [千m³/日]")
axes[1].set_xlabel("日付")
axes[1].legend()
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "homework1_halfyear.png", dpi=150)
plt.show()
```

![2019年前半で推定した二つのモデルの後半への適用](figs/08/homework1_halfyear.png)

**3．検証期間の誤差による比較**

検証期間のRMSEは，単一タンクが約1328千m³/日，並列2タンクが約1183千m³/日なので，この比較では並列2タンクの方が後半をよりよく再現した．前半で係数を推定し，後半の流入量で評価した結果を根拠にしている．
````

### 課題2の準備：並列3タンクへの拡張

第1タンクへ雨水の入力の割合 $f$ を配り，残りを割合 $g$ と $1-g$ で第2・第3タンクへ分ける．保存則と観測モデルは次のとおりである．

$$
\begin{aligned}
\frac{dS_1}{dt}&=fcAP(t)-k_1S_1,\\
\frac{dS_2}{dt}&=(1-f)gcAP(t)-k_2S_2,\\
\frac{dS_3}{dt}&=(1-f)(1-g)cAP(t)-k_3S_3,\\
Q(t)&=k_1S_1(t)+k_2S_2(t)+k_3S_3(t).
\end{aligned}
$$

- $S_1(t),S_2(t),S_3(t)$ ：各タンクの貯留量（千m³）．
- $k_1,k_2,k_3$ ：各タンクの正の流出係数（1/日）．
- $f$ ：全入力のうち第1タンクへ配る割合． $0\leq f\leq1$ とする．
- $g$ ：第1タンクへ配った残りのうち，第2タンクへ配る割合． $0\leq g\leq1$ とする．
- $c,A,P(t),Q_0$ ：並列2タンクと同じ意味で使う．

三つの分配割合の合計は $f+(1-f)g+(1-f)(1-g)=1$ となる．初日の観測流量も同じ割合で分け，初期貯留量を設定する．

$$
S_1(0)=\frac{fQ_0}{k_1},\qquad
S_2(0)=\frac{(1-f)gQ_0}{k_2},\qquad
S_3(0)=\frac{(1-f)(1-g)Q_0}{k_3}.
$$

推定する係数は $\theta_3=(c,k_1,k_2,k_3,f,g)$ の六つである．

````{warning} 課題2：並列3タンクによる流入量の推定

2019年の全日で並列3タンクの係数を推定し，係数を固定して2020年へ適用する．並列2タンクとの比較には，本文で保存した`theta2_reference`を使う．

1. 演習3の二つの関数と本文の`residuals_tank2`を変更し，<span style="color:red">並列3タンクの三つの関数をNotebookに定義せよ</span>．

右辺，初期条件，合計流出量を3タンクの式に変更する．変数名と引数の順序は次にそろえよ．

```python
def tank3_rhs(t, S, t_data, rain_data, c, k1, k2, k3, f, g):
    S1, S2, S3 = S
    rain_input = c * AREA_KM2 * np.interp(t, t_data, rain_data)
    return 【三つのタンクの変化率を順に並べたリスト】

def simulate_tank3(theta, t_data, rain_data, q0):
    c, k1, k2, k3, f, g = theta
    S10 = 【第1タンクの初期貯留量】
    S20 = 【第2タンクの初期貯留量】
    S30 = 【第3タンクの初期貯留量】
    sol = solve_ivp(
        tank3_rhs, (t_data[0], t_data[-1]), 【三つの初期貯留量のリスト】,
        t_eval=t_data, args=(t_data, rain_data, c, k1, k2, k3, f, g),
        max_step=0.25, rtol=1e-7, atol=1e-5,
    )
    return 【三つのタンクからの流出量を合計する式】

def residuals_tank3(theta, t_data, rain_data, qin_data, fit_mask):
    q_model = 【simulate_tank3による流出量の計算】
    return (q_model - qin_data)[fit_mask]
```

2. 本文の複数の初期値からの推定を変更し，<span style="color:red">2タンク・3タンクの2019年と2020年のRMSEをNotebookの比較表に出力せよ</span>．

次の設定で本文の探索を実行し，試した初期値の中でcostが最小の結果を`result_tank3`に保存せよ．課題1で期間を変更した場合も，ここでは2019年の全日を選び直す．

```python
fit_mask = np.ones(len(t_data), dtype=bool)
bounds_tank3 = ([0.0, 0.001, 0.001, 0.001, 0.0, 0.0], [1.0, 5.0, 5.0, 5.0, 1.0, 1.0])
initial_guesses_3 = [
    [1.0, 4.2, 0.4, 0.4, 0.67, 0.5],
    [0.7, 0.8, 0.2, 0.03, 0.5, 0.5],
    [0.9, 1.5, 0.1, 0.01, 0.7, 0.5],
]
```

2019年の計算には`q2_train`・`q3_train`，2020年の計算には`q2_fixed`・`q3_fixed`を使え．2020年の入力は本文の`t_valid`・`p_valid`・`q_valid`を再利用し，係数の再推定は行わずに適用する．

3. 本文の2020年の描画を変更し，観測流入量と2タンク・3タンクの計算結果を示す<span style="color:red">流入量・残差の比較図をNotebookに出力せよ</span>．
````

````{hidden-answer} 課題2の解答例

**1．並列3タンクの関数**

第2タンクへの分配に`g`を掛け，残りを第3タンクへ与える．

<!-- cell:homework2_rhs -->
```{code-block} python
:linenos:
:emphasize-lines: 2,6-7
:class: code-focus

def tank3_rhs(t, S, t_data, rain_data, c, k1, k2, k3, f, g):
    S1, S2, S3 = S
    rain_input = c * AREA_KM2 * np.interp(t, t_data, rain_data)
    return [
        f * rain_input - k1 * S1,
        (1 - f) * g * rain_input - k2 * S2,
        (1 - f) * (1 - g) * rain_input - k3 * S3,
    ]
```

同じ分配割合で三つの初期貯留量を求め，数値解から合計流出量へ換算する．

<!-- cell:homework2_simulate -->
```{code-block} python
:linenos:
:emphasize-lines: 4-5,7-8,11
:class: code-focus

def simulate_tank3(theta, t_data, rain_data, q0):
    c, k1, k2, k3, f, g = theta
    S10 = f * q0 / k1
    S20 = (1 - f) * g * q0 / k2
    S30 = (1 - f) * (1 - g) * q0 / k3
    sol = solve_ivp(
        tank3_rhs, (t_data[0], t_data[-1]), [S10, S20, S30],
        t_eval=t_data, args=(t_data, rain_data, c, k1, k2, k3, f, g),
        max_step=0.25, rtol=1e-7, atol=1e-5,
    )
    return k1 * sol.y[0] + k2 * sol.y[1] + k3 * sol.y[2]
```

本文の残差関数で，呼び出すモデルを3タンクに変える．

<!-- cell:homework2_residuals -->
```python
def residuals_tank3(theta, t_data, rain_data, qin_data, fit_mask):
    q_model = simulate_tank3(theta, t_data, rain_data, qin_data[0])
    return (q_model - qin_data)[fit_mask]
```

**2．推定と未使用年のRMSE**

2019年の全日を選び，六つの係数の上下限と探索初期値を設定する．

<!-- cell:homework2_setup -->
```python
fit_mask = np.ones(len(t_data), dtype=bool)
bounds_tank3 = ([0.0, 0.001, 0.001, 0.001, 0.0, 0.0], [1.0, 5.0, 5.0, 5.0, 1.0, 1.0])
initial_guesses_3 = [
    [1.0, 4.2, 0.4, 0.4, 0.67, 0.5],
    [0.7, 0.8, 0.2, 0.03, 0.5, 0.5],
    [0.9, 1.5, 0.1, 0.01, 0.7, 0.5],
]
```

本文と同じ探索の手順で，試した初期値の中からcostが最小の結果を保存する．

<!-- cell:homework2_fit -->
```python
fit_rows3 = []
best_cost3 = np.inf
for guess in initial_guesses_3:
    res3 = least_squares(
        residuals_tank3, guess,
        args=(t_data, rain_obs, qin_obs, fit_mask),
        bounds=bounds_tank3, diff_step=0.01,
    )
    c3, k13, k23, k33, f3, g3 = res3.x
    rmse3 = np.sqrt(np.mean(res3.fun ** 2))
    fit_rows3.append([c3, k13, k23, k33, f3, g3, rmse3, res3.success])
    if res3.cost < best_cost3:
        best_cost3 = res3.cost
        result_tank3 = res3
fit_table3 = pd.DataFrame(fit_rows3, columns=["c", "k1", "k2", "k3", "f", "g", "RMSE [千m³/日]", "停止条件"])
print(fit_table3.round(3).to_string(index=False))
```

出力例：

<!-- output:homework2_fit -->
```text
c    k1    k2    k3     f     g  RMSE [千m³/日]  停止条件
1.0 4.230 0.409 0.378 0.671 0.829       277.051  True
1.0 4.453 1.455 0.366 0.627 0.205       277.010  True
1.0 4.420 0.532 0.116 0.647 0.822       276.797  True
```

保存した2タンクの係数と，推定した3タンクの係数で両年を計算する．

<!-- cell:homework2_compare -->
```python
q2_train = simulate_tank2(theta2_reference, t_data, rain_obs, qin_obs[0])
q3_train = simulate_tank3(result_tank3.x, t_data, rain_obs, qin_obs[0])
q2_fixed = simulate_tank2(theta2_reference, t_valid, p_valid, q_valid[0])
q3_fixed = simulate_tank3(result_tank3.x, t_valid, p_valid, q_valid[0])
rmse2_2019 = np.sqrt(np.mean((q2_train - qin_obs) ** 2))
rmse3_2019 = np.sqrt(np.mean((q3_train - qin_obs) ** 2))
rmse2_2020 = np.sqrt(np.mean((q2_fixed - q_valid) ** 2))
rmse3_2020 = np.sqrt(np.mean((q3_fixed - q_valid) ** 2))
comparison3 = pd.DataFrame({
    "モデル": ["並列2タンク", "並列3タンク"],
    "係数の個数": [4, 6],
    "2019年のRMSE": [rmse2_2019, rmse3_2019],
    "2020年のRMSE": [rmse2_2020, rmse3_2020],
})
print(comparison3.round(1).to_string(index=False))
```

RMSEの単位は千m³/日である．

出力例：

<!-- output:homework2_compare -->
```text
モデル  係数の個数  2019年のRMSE  2020年のRMSE
並列2タンク      4       277.1       316.7
並列3タンク      6       276.8       315.6
```

この例では3タンクのRMSEは両年ともわずかに小さい．推定する係数は4個から6個に増えているため，改善の大きさとモデルの複雑さを併せて判断する．

**3．2020年の流入量と残差**

本文の2020年の比較図で，二つの曲線を2タンクと3タンクの計算結果に置き換える．

<!-- cell:homework2_plot -->
```python
fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].plot(data_valid["date"], q_valid, color="black", label="観測流入量")
axes[0].plot(data_valid["date"], q2_fixed, color="tab:blue", label="並列2タンク")
axes[0].plot(data_valid["date"], q3_fixed, color="tab:orange", linestyle="--", label="並列3タンク")
axes[0].set_title(f"並列2タンクと3タンクの比較（{valid_year}年）")
axes[0].set_ylabel("流量 [千m³/日]")
axes[0].legend()
axes[1].plot(data_valid["date"], q2_fixed - q_valid, color="tab:blue", label="並列2タンク")
axes[1].plot(data_valid["date"], q3_fixed - q_valid, color="tab:orange", linestyle="--", label="並列3タンク")
axes[1].axhline(0, color="black", linewidth=0.8)
axes[1].set_ylabel("計算流量−観測流量 [千m³/日]")
axes[1].set_xlabel("日付")
axes[1].legend()
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "homework2_three_tanks.png", dpi=150)
plt.show()
```

![2019年の係数を2020年へ適用した並列2タンクと3タンクの流入量・残差](figs/08/homework2_three_tanks.png)
````

### 提出先・期限

- 提出場所：WebClass「第8回課題」．
- 提出物：`README.md`とNotebookファイル`tank_model.ipynb`．
- 提出期限：2026年11月28日(土)23:59．

## 補足：モデルの選択とデータの追加

- **対象と流量の決まり方**：今回は集水域の貯留からの流出をモデル化した．ダムの放流量をモデル化する場合は，水位に加え，放流設備や運用計画との関係を調べる．
- **雨の空間分布**：流域内の複数地点の雨量や分布を持つ雨量データで，流域への入力を比較する．
- **雨と流量の時間分解能**：日内の速い応答を調べるには，時間ごとのデータを使って残差の変化を確認する．
- **貯留の構造**：並列配置のほか，タンク間の浸透を含む直列配置も考えられる．[気象庁の土壌雨量指数](https://www.jma.go.jp/jma/kishou/know/bosai/dojoshisu.html)では，降った雨が土壌中に貯まる過程を直列3段のタンクで表している．用途と表したい過程に合わせて構造を選ぶ．

## 自主学習用の発展課題

### 二つのタンクと単一タンクが一致する条件

並列2タンクの流出量が，単一タンクと完全に一致する条件を検討する．初期貯留量は本文と同じ設定を使い，初日の流出量は $Q_0>0$ とする．

````{note} 発展課題：モデルの一致条件と分配割合の影響

1. $k_1=k_2=k$ とし，合計貯留量を $S(t)=S_1(t)+S_2(t)$ と置く．雨水の入力がある場合も含め，割合 $f$ によらず単一タンクと同じ流出量になることを，<span style="color:red">保存則・観測モデル・初期条件から数式で示せ</span>．
2. 無降雨で $0<f<1$ の場合を考える．並列2タンクの流出量を，すべての $t\geq0$ について $Q_0e^{-kt}$ と表せるためには $k_1=k_2$ が必要であることを，<span style="color:red">数式で証明せよ</span>．初期時刻における1階・2階の導関数を比較せよ．
3. 無降雨で $(k_1,k_2)=(0.2,0.2),(0.2,0.205),(0.1,0.5)$ の三つを比べる．各組について $f=0.2$ と $f=0.8$ の流出量の差の絶対値を求め，<span style="color:red">時間変化を示す比較図をNotebookに出力せよ</span>．本文の`t_demo`・`rain_demo`・`q0_demo`と`simulate_tank2`を使い， $c=0.7$ に固定せよ．
````

````{hidden-answer} 発展課題の解答例

**1．時定数が等しい場合の一致**

**主張**： $k_1=k_2=k>0$ のとき，本文の初期条件を使う並列2タンクは，任意の $0\leq f\leq1$ に対して同じ単一タンクの流出量を与える．

**証明・ステップ1：保存則の加算**

二つの保存則を足すと，入力の分配割合が消え，合計貯留量の式が閉じる．

$$
\begin{aligned}
\frac{dS}{dt}
&=fcAP(t)+(1-f)cAP(t)-kS_1-kS_2\\
&=cAP(t)-kS.
\end{aligned}
$$

**証明・ステップ2：観測モデルの確認**

合計流出量も合計貯留量だけから計算できる．

$$
Q(t)=kS_1(t)+kS_2(t)=kS(t).
$$

**初期条件の確認**

$$
S(0)=\frac{fQ_0}{k}+\frac{(1-f)Q_0}{k}=\frac{Q_0}{k}.
$$

保存則・観測モデル・初期条件が単一タンクと一致する．したがって，同じ降水入力から得られる流出量も一致する．この条件では $f$ が合計流出量に現れず，流量の観測だけでは $f$ の値を区別できない．

**2．無降雨時の一致に必要な条件**

**主張**： $Q_0>0$， $0<f<1$ の下で，無降雨の並列2タンクの流出量が，ある定数 $k>0$ によりすべての $t\geq0$ で $Q_0e^{-kt}$ と表されるならば， $k_1=k_2$ である．

**証明・ステップ1：二つの減衰の合計**

本文の初期条件から，無降雨時の合計流出量は次の形になる．

$$
Q(t)=Q_0\left(fe^{-k_1t}+(1-f)e^{-k_2t}\right).
$$

**証明・ステップ2：初期時刻の導関数の比較**

仮に $Q(t)=Q_0e^{-kt}$ なら，1階・2階の導関数も一致するため，

$$
\begin{aligned}
k&=fk_1+(1-f)k_2,\\
k^2&=fk_1^2+(1-f)k_2^2
\end{aligned}
$$

を満たす．第1式を第2式へ代入すると，

$$
\begin{aligned}
0
&=fk_1^2+(1-f)k_2^2-\left(fk_1+(1-f)k_2\right)^2\\
&=f(1-f)(k_1-k_2)^2.
\end{aligned}
$$

 $0<f<1$ より $f(1-f)>0$ なので， $k_1=k_2$ を得る．

**初期条件・特殊例の確認**

 $t=0$ では両方の式が $Q_0$ を与える． $f=0$ または $f=1$ では一方のタンクの入力と初期貯留量が0となり，一つのタンクだけで流出を表せる．このため主張では $0<f<1$ を仮定した．

**3．分配割合による流出量の違い**

まず，同じ流出係数の二つのタンクで，割合だけを変えた差を求める．

<!-- cell:advanced_equal -->
```python
q_f02 = simulate_tank2((0.7, 0.2, 0.2, 0.2), t_demo, rain_demo, q0_demo)
q_f08 = simulate_tank2((0.7, 0.2, 0.2, 0.8), t_demo, rain_demo, q0_demo)
difference_equal = np.abs(q_f02 - q_f08)
```

流出係数が近い場合も同じ手順で計算する．

<!-- cell:advanced_close -->
```{code-block} python
:linenos:
:emphasize-lines: 1-2
:class: code-focus

q_f02 = simulate_tank2((0.7, 0.2, 0.205, 0.2), t_demo, rain_demo, q0_demo)
q_f08 = simulate_tank2((0.7, 0.2, 0.205, 0.8), t_demo, rain_demo, q0_demo)
difference_close = np.abs(q_f02 - q_f08)
```

流出係数が離れた場合も計算し，比較する差の配列をそろえる．

<!-- cell:advanced_separate -->
```{code-block} python
:linenos:
:emphasize-lines: 1-2
:class: code-focus

q_f02 = simulate_tank2((0.7, 0.1, 0.5, 0.2), t_demo, rain_demo, q0_demo)
q_f08 = simulate_tank2((0.7, 0.1, 0.5, 0.8), t_demo, rain_demo, q0_demo)
difference_separate = np.abs(q_f02 - q_f08)
```

本文の2段の描画を使い，上段に流出係数が同じ場合・近い場合，下段に離れた場合の差を描く．

<!-- cell:advanced_plot -->
```python
fig, axes = plt.subplots(2, 1, figsize=(9, 6), sharex=True)
axes[0].plot(t_demo, difference_equal, color="gray", linestyle="--", label="k1 = k2 = 0.2")
axes[0].plot(t_demo, difference_close, color="tab:blue", label="k1 = 0.2，k2 = 0.205")
axes[0].set_title("時定数が同じ場合と近い場合")
axes[0].set_ylabel("流出量の差 [千m³/日]")
axes[0].legend()
axes[1].plot(t_demo, difference_separate, color="tab:orange", label="k1 = 0.1，k2 = 0.5")
axes[1].set_title("時定数が離れている場合")
axes[1].set_ylabel("流出量の差 [千m³/日]")
axes[1].set_xlabel("経過日数 [日]")
axes[1].legend()
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "advanced_time_constants.png", dpi=150)
plt.show()
```

![分配割合を0.2から0.8へ変えたときの流出量の差と時定数の関係](figs/08/advanced_time_constants.png)

時定数が等しい場合は，割合を変えても合計流出量が一致する．差の最大値は，時定数が近い組で約0.54千m³/日，離れた組で約32.1千m³/日である．上下の図の縦軸の目盛にも注意して比較する．

割合の変更による差が観測誤差と比べて小さい場合は，流量から割合を推定することが難しくなる．二つのタンクの役割を解釈するときは，時定数の違いと観測データの精度を併せて確認する．
````
