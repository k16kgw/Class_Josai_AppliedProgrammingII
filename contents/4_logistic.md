# 第4回　仮定の追加とLogisticモデル

## 今回の位置付け

$$
\text{モデルを作る}
\rightarrow
\text{計算する}
\rightarrow
\text{データと比べる}
\rightarrow
\underline{\text{合わない理由を考える}}
\rightarrow
\underline{\text{仮定を見直す}}
$$

第3回では，指数成長モデル $N' = rN$ が1970年ごろまでの日本の人口をよく表し，その後は観測値を大きく上回ることを見た．
今回は，この講義で繰り返す循環の後半，残差の要因の検討とモデルの仮定の見直しを初めて実行する．

前回の数値誤差の確認から，観測値との差を数値計算の誤差だけで説明することはできない．
ここでは，人口の増加率を一定とする仮定を見直す．
その仕組みを1つ選んで仮定として式に加え，新しいモデルを作り，元のモデルと同じデータ・同じ指標で比べる．
そして，新しいモデルにもまだ表せないことがあることを確認する．

## 今回の到達目標

- 指数成長モデルが長期的に合わない理由を，データから読み取った証拠をもとに説明できる
- 一人あたりの増加率が人口に対して線形に減少するという仮定を式にし，Logisticモデル $N' = rN(1 - N/K)$ を導ける
- $1 - N/K$ の意味を，$N \ll K$，$N = K$，$N > K$ の場合に分けて説明できる
- Logisticモデルを`solve_ivp`で解き，初期値と $K$ を変えたときの挙動を説明できる
- 指数成長モデルとLogisticモデルを，同じデータ，同じ誤差指標で比較できる
- パラメタを増やしたモデルが常に良いとは限らない理由を述べられる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第3回の復習，残差の要因の検討（演習0） | 10分 |
| 2 | データから見る増加率の低下，仮定の追加，Logisticモデルの導出と各項の意味 | 25分 |
| 3 | Logisticモデルの実装，初期値と $K$ による挙動の違い（演習1） | 20分 |
| 4 | 2つのモデルを同じデータ・同じ指標で比較，$K$ と $r$ を手で変える（演習2〜3） | 35分 |
| 5 | Logisticモデルでも表せないことの共有，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

第3回の残差の図では，1975年以降，観測値がモデルを下回り続け，その差が年とともに広がった．
指数成長モデルでは，正の初期人口に対し，定数 $r$ が正なら単調増加，負なら単調減少，0なら一定となる．したがって，増加から減少への転換や，正の一定値への収束を表せない．

今回は，この外れ方を手掛かりに仮定を見直す．
第1回の「モデルの限界と改善の問い」で挙げた資源や空間の制約を想定し，一人あたりの増加率が人口に依存すると仮定する．
記号は第3回と同じく，人口を $N$，時間を $t$（年，1920年を $t = 0$）とする．

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第4回の作業フォルダを作成する．

```bash
mkdir -p ~/applied_programming_ii/04
cd ~/applied_programming_ii/04
mkdir -p notebooks reports/figures
```

2. `notebooks/logistic.ipynb`を新規作成する．

3. `04`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第4回

- 氏名：
- 学籍番号：

## 今日の目標

指数成長モデルが外れた理由を考え，仮定を追加したLogisticモデルを作って2つのモデルを比較する．

## 指数成長モデルが外れた理由の候補

-
-

## モデルの記録

- 微分方程式：dN/dt = r N (1 - N/K)
- 追加した仮定：
- パラメタ r，K の値と決め方：
- 初期値：

## 演習1〜3の記録

| モデル | r | K | 全期間のMSE | 2020年の値 |
| --- | --- | --- | --- | --- |

## 課題1

## 課題2の考察
```

4. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．

```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp

PROJECT_DIR = Path.home() / "applied_programming_ii" / "04"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("人口データの有無:", (DATA_DIR / "population_japan.csv").exists())
```

5. 第3回で作った関数を再定義し，データを読み込む．今回もこれらをそのまま使う．

```python
def exponential_rhs(t, N, r):
    """指数成長モデル dN/dt = r N の右辺．"""
    return r * N


def exponential_solution(t, N0, r, t0=0.0):
    """dN/dt = r N, N(t0) = N0 の解析解を返す．"""
    return N0 * np.exp(r * (t - t0))


def mean_squared_error(y_obs, y_model):
    """観測値とモデル値の平均二乗誤差を返す．"""
    return np.mean((y_obs - y_model) ** 2)


population = pd.read_csv(DATA_DIR / "population_japan.csv")
population["population_10k"] = population["total_population_thousand"] / 10

year_obs = population["year"].to_numpy()
t_obs = (year_obs - 1920).astype(float)          # 1920年を t = 0 とする [年]
y_obs = population["population_10k"].to_numpy()  # 観測値 [万人]
N0 = y_obs[0]                                     # 1920年の人口 [万人]

print(f"観測値の数: {len(y_obs)}，初期値 N0 = {N0:.1f} 万人")
```
````

## なぜ指数成長は続かないのか

### 学生に考えてもらう問い

コードを動かす前に，指数成長モデルが1975年以降に外れた理由を考える．
`README.md`の「指数成長モデルが外れた理由の候補」に，思いつく要因を2つ以上書く．
隣の人と見せ合い，それぞれの要因が $r$ を一定とする仮定とどのように矛盾するかを話す．

思いつく要因は多いが，モデルの言葉で整理すると次のように分けられる．

| 要因 | モデルの言葉で言うと |
| --- | --- |
| 出生率の低下，晩婚化 | 出生率 $b$ が時間とともに下がる |
| 高齢化 | 死亡率 $d$ が時間とともに上がる |
| 住宅，雇用，教育費の制約 | 人口 $N$ が多いほど一人あたりの増加率が下がる |
| 出入国 | 外部入力の無視 |

今回は3行目の人口に依存した一人あたり増加率の低下を式に入れる．
1行目や2行目は増加率を時間の関数 $r(t)$ とする別の仮定であり，今回の最後で発展として触れる．

### データで確かめる：一人あたりの増加率は下がっているか

指数成長モデルでは，一人あたりの増加率 $\dfrac{1}{N}\dfrac{dN}{dt}$ は定数 $r$ である．
観測値からこの量を近似的に計算し，人口 $N$ に対して描いてみる．
変化率は，5年間の差分で近似する．

```python
step = 5   # 差分をとる間隔 [年]

# 5年ごとの値を取り出す
mask_5y = (year_obs % 5 == 0)
year_5y = year_obs[mask_5y]
y_5y = y_obs[mask_5y]

# 一人あたりの増加率 (N_{k+1} - N_k) / (step * N_k) を計算する
per_capita_rate = (y_5y[1:] - y_5y[:-1]) / (step * y_5y[:-1])
N_mid = y_5y[:-1]          # 各区間の始めの人口

fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(N_mid, per_capita_rate, marker="o", linestyle="none")
for N_k, rate, yr in zip(N_mid, per_capita_rate, year_5y[:-1]):
    if yr % 20 == 0:
        ax.annotate(str(yr), (N_k, rate), textcoords="offset points", xytext=(4, 4), fontsize=8)
ax.axhline(0, color="black", linewidth=0.8)
ax.set_title("Per-capita growth rate vs. population (5-year differences)")
ax.set_xlabel("Population N [10^4 persons]")
ax.set_ylabel("(1/N) dN/dt [1/year]")
ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "per_capita_rate_vs_N.png", dpi=150)
plt.show()
```

1940年から1945年の区間（戦争の影響）を除けば，人口が多いほど一人あたりの増加率が低く，およそ直線的に下がって，人口1億2000万人台でゼロを横切る．
指数成長モデルはこの図で水平な直線を仮定していたことになる．
この散布図では，人口が大きい観測時点ほど推定した一人あたり増加率が低い傾向が見られる．この関係だけでは，増加率が人口のみの関数であるとは判断できない．

```{tip} データがモデルを決めるのではない
この図の負の関連だけから，人口増加が一人あたり増加率の低下を引き起こしたとは結論できない．
資源制約かもしれないし，出生率の低下がたまたま人口増加と同時期に起きただけかもしれない．
ここでは，人口の増加により一人あたりの利用可能資源が減少し，純増加率が低下するという仕組みを，モデル化の候補として検討する．
同じ観測結果は，人口とは独立に増加率が時間とともに低下した場合にも生じ得る．
どちらの仮定を選ぶかは，モデルを作る人の判断である．
```

## 仮定を追加する：Logisticモデル

### 仮定を言葉で置く

指数成長モデルの仮定に，次の1つを加える．

**追加する仮定：一人あたりの増加率は，人口が増えるにつれて直線的に下がり，人口がある値 $K$ に達するとゼロになる．**

以下では $r>0$，$K>0$，$N_0>0$ とする．$K$ は純増加率が0となる正の平衡人口であり，資源制約を仮定したモデルでは**環境収容力**と呼ぶ．人口が一時的にも超えられない絶対的な上限ではない．

### 式を導く

一人あたりの増加率を $N$ の1次関数で書く．
$N = 0$ のとき $r$，$N = K$ のとき $0$ となる1次関数は

$$
r_{\mathrm{eff}}(N) = r\left(1 - \frac{N}{K}\right)
$$

である．
これを指数成長モデルの $r$ の代わりに置くと，

$$
\frac{dN}{dt} = r_{\mathrm{eff}}(N)\,N = r\,N\left(1 - \frac{N}{K}\right)
$$

を得る．
これが**Logisticモデル**である．

| 項 | 意味 | 単位 |
| --- | --- | --- |
| $r$ | 人口が少ないときの一人あたり増加率（内的増加率） | 1／年 |
| $K$ | 環境収容力．正の初期値からの解が長期的に収束する人口 | 万人 |
| $N/K$ | 収容力に対する現在の人口の割合 | 無次元 |
| $1 - N/K$ | 人口依存の相対増加率を内的増加率 $r$ で割った値 | 無次元 |
| $rN(1 - N/K)$ | 人口の瞬間的な変化率 | 万人／年 |

右辺の単位は $(1/\text{年}) \times \text{万人} \times \text{無次元} = \text{万人}/\text{年}$ で，左辺と一致する．
指数成長モデルと比べて，パラメタが $r$ の1つから $r$，$K$ の2つに増えた．

### $1 - N/K$ の意味を場合分けで理解する

- $N \ll K$ のとき：$N/K \approx 0$ なので $1 - N/K \approx 1$ となり，$N' \approx rN$ となる．人口が少ないうちは指数成長モデルと区別がつかない
- $N = K$ のとき：$1 - N/K = 0$ なので $N' = 0$ となり，人口は変化しない．$K$ は**平衡点**である
- $N > K$ のとき：$1 - N/K < 0$ なので $N' < 0$ となり，人口は減って $K$ に戻る

つまりLogisticモデルの解は，$K$ より小さい初期値から出発すれば増えて $K$ に近づき，$K$ より大きい初期値から出発すれば減って $K$ に近づく．
いずれの場合も $t\to\infty$ で $N(t)\to K$ となる．$N_0=0$ の場合は $N(t)=0$ のままである．

````{dropdown} 補足：解析解

初期条件 $N(0) = N_0$ のもとで，Logisticモデルの解は

$$
N(t) = \frac{K}{1 + \left(\dfrac{K - N_0}{N_0}\right)e^{-rt}}
$$

である．
$t \to \infty$ で $e^{-rt} \to 0$ となるので $N(t) \to K$ に近づく．
$t = 0$ では分母が $1 + (K - N_0)/N_0 = K/N_0$ となり，$N(0) = N_0$ を満たす．

導出は変数分離による．
$\dfrac{dN}{N(1 - N/K)} = r\,dt$ と書き，左辺を部分分数に分けて $\dfrac{1}{N} + \dfrac{1/K}{1 - N/K}$ として積分すると，$\ln\left|\dfrac{N}{1 - N/K}\right| = rt + C$（$N\ne K$） を得る．
これを $N$ について解けば上の式になる．
今回はこの式を，数値解の検算に使う．
````

## Pythonによる実装

### 右辺と解析解

```python
def logistic_rhs(t, N, r, K):
    """Logisticモデル dN/dt = r N (1 - N/K) の右辺．"""
    return r * N * (1 - N / K)


def logistic_solution(t, N0, r, K, t0=0.0):
    """dN/dt = r N (1 - N/K), N(t0) = N0 の解析解を返す．"""
    return K / (1 + ((K - N0) / N0) * np.exp(-r * (t - t0)))
```

### 数値解と解析解を確かめる

$r = 0.03$／年，$K = 15000$ 万人として計算する．
この値はまず手で選んだもので，あとでデータに合わせて変える．

```python
# パラメタ（まず手で選ぶ）
r_trial = 0.03       # 内的増加率 [1/年]
K_trial = 15000.0    # 環境収容力 [万人]

# 計算区間：1920年から2050年まで
t_span = (0.0, 130.0)
t_eval = np.arange(0.0, 131.0)

sol = solve_ivp(logistic_rhs, t_span, [N0], t_eval=t_eval, args=(r_trial, K_trial))
N_numeric = sol.y[0]
N_analytic = logistic_solution(t_eval, N0, r_trial, K_trial)

print(f"数値解と解析解の最大差: {np.max(np.abs(N_numeric - N_analytic)):.3f} 万人")

fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(1920 + t_eval, N_analytic, color="black", label="analytical solution")
ax.plot(1920 + t_eval, N_numeric, linestyle="--", label="solve_ivp")
ax.axhline(K_trial, color="gray", linestyle=":", label=f"K = {K_trial:.0f}")
ax.set_title(f"Logistic model (r = {r_trial}, K = {K_trial:.0f})")
ax.set_xlabel("Year")
ax.set_ylabel("Population N [10^4 persons]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "logistic_analytic_vs_numeric.png", dpi=150)
plt.show()
```

曲線はS字型になる．
最初は指数成長と同じように加速して増え，$K/2$ 付近で増え方が最大になり，その後は鈍って $K$ に近づく．

````{note} 演習1：初期値と $K$ を変える

1. 初期値`N0`の代わりに`3000.0`，`10000.0`，`18000.0`を与えて計算し，3本の曲線を1枚の図に描く．$K$ より大きい初期値から出発した場合に何が起きるか．
2. $K$ を`12000.0`，`15000.0`，`20000.0`に変え，$r = 0.03$ のまま計算して比べる．$K$ は曲線のどこを変え，どこを変えないか．
3. $r$ を`0.02`，`0.03`，`0.05`に変え，$K = 15000$ のまま計算して比べる．$r$ は曲線のどこを変えるか．
4. 上の結果から，$r$ と $K$ の役割を`README.md`に1行ずつで書く．
````

```{dropdown} 演習1の確認
- $K$ より大きい初期値から出発すると，人口は単調に減って $K$ に近づく．$1 - N/K < 0$ で変化率が負になるためである．
- $K$ は長期的な収束値を決める．初期の増え方は $K$ にほとんどよらない（$N \ll K$ では $N' \approx rN$）．
- $r$ は $K$ に近づく速さを決める．$r$ が大きいほど早くS字の中央部分を通過する．長期的な収束値は変わらない．
```

## 2つのモデルを同じデータ・同じ指標で比較する

### 比較の条件をそろえる

モデルを比較するときは，同じデータ，同じ期間，同じ誤差指標を使う．
ここでは1920年から2020年の全期間の観測値に対して，第3回で定義した平均二乗誤差を計算する．
指数成長モデルのパラメタには，第3回の対数線形法で1920〜1970年から決めた値を使う．

```python
# 指数成長モデル：第3回の対数線形法（1920〜1970年）で決めた値
fit_mask = year_obs <= 1970
slope, intercept = np.polyfit(t_obs[fit_mask], np.log(y_obs[fit_mask]), 1)
r_exp = slope
N0_exp = np.exp(intercept)

N_exp = exponential_solution(t_obs, N0_exp, r_exp)
N_log = logistic_solution(t_obs, N0, r_trial, K_trial)

mse_exp = mean_squared_error(y_obs, N_exp)
mse_log = mean_squared_error(y_obs, N_log)

print(f"指数成長モデル   r = {r_exp:.4f}                : MSE = {mse_exp:12.0f} （万人）^2，平方根 = {np.sqrt(mse_exp):6.0f} 万人")
print(f"Logisticモデル   r = {r_trial:.4f}, K = {K_trial:.0f}: MSE = {mse_log:12.0f} （万人）^2，平方根 = {np.sqrt(mse_log):6.0f} 万人")
print(f"2020年の観測値: {y_obs[-1]:.0f} 万人，指数成長モデル: {N_exp[-1]:.0f} 万人，Logisticモデル: {N_log[-1]:.0f} 万人")
```

手で選んだだけの $r = 0.03$，$K = 15000$ でも，Logisticモデルの誤差は指数成長モデルの十数分の1になる．
平方根で見ると，RMSEが約2000万人から約500万人に減少する．

### 図で比較する

```python
fig, axes = plt.subplots(2, 1, figsize=(8, 7), sharex=True)

ax = axes[0]
ax.plot(year_obs, y_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
ax.plot(year_obs, N_exp, linestyle="--", label=f"exponential (r = {r_exp:.4f})")
ax.plot(year_obs, N_log, linestyle="-", label=f"logistic (r = {r_trial}, K = {K_trial:.0f})")
ax.set_title("Exponential vs. logistic model, population of Japan")
ax.set_ylabel("Population [10^4 persons]")
ax.set_ylim(0, 20000)
ax.grid(True)
ax.legend()

ax = axes[1]
ax.plot(year_obs, y_obs - N_exp, linestyle="--", marker="o", markersize=2, label="exponential")
ax.plot(year_obs, y_obs - N_log, linestyle="-", marker="s", markersize=2, label="logistic")
ax.axhline(0, color="black", linewidth=0.8)
ax.set_title("Residual: observed - model")
ax.set_xlabel("Year")
ax.set_ylabel("Residual [10^4 persons]")
ax.set_ylim(-3000, 3000)
ax.grid(True)
ax.legend()

fig.tight_layout()
fig.savefig(FIGURE_DIR / "exponential_vs_logistic.png", dpi=150)
plt.show()
```

残差の図では，Logisticモデルの残差は全期間で数百万人以内に収まる．
しかし，形をよく見ると2つの特徴がある．

- 1950年から1980年ごろ，観測値がモデルを上回る（残差が正）．S字の立ち上がりが観測値より遅い
- 2010年以降，観測値がモデルを下回り，残差は負へ広がり続ける．モデルは $K$ に向かって増え続けるが，観測値は減っている

### $K$ と $r$ を手で変える

$K$ と $r$ を数通り変えて，誤差がどう変わるかを表にする．

```python
K_values = [12000.0, 13000.0, 15000.0]
r_values = [0.02, 0.03, 0.04]

print(f"{'K [万人]':>10} {'r [1/年]':>10} {'MSE':>12} {'sqrt(MSE)':>10} {'N(2020)':>10}")
for K_value in K_values:
    for r_value in r_values:
        N_try = logistic_solution(t_obs, N0, r_value, K_value)
        mse_try = mean_squared_error(y_obs, N_try)
        print(f"{K_value:10.0f} {r_value:10.3f} {mse_try:12.0f} {np.sqrt(mse_try):10.0f} {N_try[-1]:10.0f}")
```

同じ $K$ でも $r$ によって誤差は大きく変わり，同じ $r$ でも $K$ によって変わる．
また，$K = 15000$，$r = 0.03$ の組と，$K = 13000$，$r = 0.04$ の組のように，異なる組が近い誤差を与えることがある．
$K$ を小さくすると $r$ を大きくして立ち上がりを補う必要があり，2つのパラメタは互いに影響し合う．
手で変えるだけでは，どこに最も良い組があるのかを見つけにくい．

````{note} 演習2：手でパラメタを合わせる

1. 上の表を`README.md`の表に転記する．
2. 表の中で最も誤差が小さい組を見つけ，その組で「図で比較する」の図を描き直す．
3. その組の周りで $K$ を500万人刻み，$r$ を0.005刻みで動かし，さらに誤差が小さくなる組を探す．何回試したか，どこまで下がったかを記録する．
4. 手動でパラメタの候補を選ぶ方法の限界を1〜2行で書く．
````

````{note} 演習3：$K$ の意味を考える

日本の人口は2008年に約1億2800万人で最大となり，その後減少している．

1. 表の結果から，最大値に近い $K = 13000$ 万人が最も良いとは限らないことを確認する．なぜそうなるか，S字の立ち上がりの時期に注目して説明する．
2. $K$ を資源制約によって定まる平衡人口と解釈した場合，日本の人口が1億2800万人で頭打ちになったのは資源や空間の制約のせいだと言えるか．他にどのような説明がありうるか．
3. Logisticモデルが2010年以降の減少を表せない理由を，$1 - N/K$ の符号を使って説明する．
````

```{dropdown} 演習3の確認
- Logisticモデルでは，$K$ は長期的な収束値だけでなく，$N \approx K/2$ で増え方が最大になるという形でS字全体の形も決める．$K = 13000$ にすると，増え方が最大になる人口が6500万人付近，すなわち1930年代になり，実際に増加が速かった1950〜1970年代とずれる．全期間の誤差を小さくするには，$K$ を実際の最大値より大きくとって立ち上がりを遅らせるほうが有利になる．
- 頭打ちを資源制約だけで説明するのは難しい．出生率の低下は所得や教育や価値観の変化とも関係し，人口の増加が一人あたり増加率を低下させたという因果関係とは言い切れない．Logisticモデルは頭打ちの形を表せるが，その原因を特定するものではない．
- $N \le K$ の間は $1 - N/K \ge 0$ なので $N' \ge 0$ であり，人口は減らない．減少を表すには $N > K$ が必要だが，$K$ より小さい初期値から出発した解は $K$ を超えない．
```

## モデルの限界と改善の問い

### Logisticモデルにも表せないこと

Logisticモデルは，指数成長モデルが表せなかった人口が $K/2$ を超えた後の変化率の低下と，正の平衡人口への収束を表せるようになった．
しかし，2010年以降の減少は表せない．
Logisticモデルの解は $K$ に向かって単調に近づくだけで，$K$ を超えてから戻ることも，増えた後に減ることもない．

日本の人口を表すには，さらに仮定を見直す必要がある．
候補は複数ある．

- $r$ を時間の関数 $r(t)$ にして，出生率の低下を直接表す
- 年齢構成を状態変数に入れ，若年層と高齢層を分ける（連立系，第10回以降の考え方）
- 出入国を外部入力として与える（第6回の考え方）

### 複雑なモデルが常に良いとは限らない

パラメタを1つ増やしただけで，誤差は十数分の1になった．
元のモデルを特殊な場合として含む拡張モデルでは，同じ訓練データと目的関数に対する最小値は，厳密に最小化できれば元のモデルより大きくならない．ただし，任意のモデル間で成り立つ性質ではなく，数値最適化が最小値に到達する保証もない．
しかし，それは必ずしもモデルが良くなったことを意味しない．

- 適合度の改善だけではパラメタの物理的・社会的解釈を裏付けられない．例えば $K=15000$ 万人はモデル上の平衡人口だが，この推定値が日本の資源制約を表すかは，人口時系列とは別の情報による検証が必要である
- パラメタが増えると，データの偶然の揺らぎにまで合わせてしまい，パラメタを決めた期間の外側で予測が悪くなることがある．これを**過学習**と呼び，第7回と第12回で扱う
- パラメタが増えると，演習2で見たように，異なるパラメタの組が同じような誤差を与えるようになり，どの組が正しいのか決めにくくなる

モデルを選ぶときは，誤差の小ささだけでなく，各パラメタの意味を説明できるか，パラメタを決めた期間の外側でも使えるか，を一緒に考える．
現象の仕組みを説明するという目的から見れば，パラメタが少なくて意味が明確なモデルのほうが価値が高いこともある．

````{dropdown} 発展演習：増加率が時間とともに下がるモデル

出生率の低下を直接表すために，$r$ を時間の1次関数 $r(t) = r_0 - c\,t$ に置き換えたモデルを考える．

$$
\frac{dN}{dt} = (r_0 - c\,t)\,N\left(1 - \frac{N}{K}\right)
$$

$c > 0$ なら，$t > r_0/c$ で増加率が負になり，人口は減少に転じる．
パラメタは $r_0$，$c$，$K$ の3つになる．

```python
def logistic_decreasing_r_rhs(t, N, r0, c, K):
    """増加率が r(t) = r0 - c t で下がるLogisticモデルの右辺．"""
    return (r0 - c * t) * N * (1 - N / K)


# 全期間の誤差が小さくなるように選んだ値（c > 0 の範囲で探索した結果）
r0_trial, c_trial, K_trial2 = 0.020, 0.00018, 40000.0

sol_rt = solve_ivp(logistic_decreasing_r_rhs, (0.0, 100.0), [N0], t_eval=t_obs, args=(r0_trial, c_trial, K_trial2))
N_rt = sol_rt.y[0]
print(f"r(t) が負になる年: {1920 + r0_trial / c_trial:.0f} 年")
print(f"MSE = {mean_squared_error(y_obs, N_rt):.0f} （万人）^2，2020年の値 = {N_rt[-1]:.0f} 万人")

# 2050年まで延ばして減少に転じる様子を見る
t_long = np.arange(0.0, 131.0)
sol_rt_long = solve_ivp(logistic_decreasing_r_rhs, (0.0, 130.0), [N0], t_eval=t_long, args=(r0_trial, c_trial, K_trial2))

fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(year_obs, y_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
ax.plot(1920 + t_long, sol_rt_long.y[0], label="logistic with r(t) = r0 - c t")
ax.plot(year_obs, logistic_solution(t_obs, N0, 0.03, 15000.0), linestyle="--", label="logistic (r = 0.03, K = 15000)")
ax.set_title("Logistic model with decreasing growth rate")
ax.set_xlabel("Year")
ax.set_ylabel("Population [10^4 persons]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "logistic_decreasing_r.png", dpi=150)
plt.show()
```

この値では，全期間の誤差は約10万（万人）$^2$ となり，$K$ を固定したLogisticモデルより小さくなる．
しかし，選ばれた $K = 40000$ 万人（4億人）には環境収容力としての意味がなく，減少に転じるのも2031年で，観測値が2008年から減っていることとは合わない．
誤差が下がったのは，$K$ を極端に大きくして $1 - N/K$ をほぼ1に保ち，増加率の低下だけで曲線の形を作っているためである．

1. 3つのパラメタそれぞれの意味と単位を書く．$K = 40000$ 万人はどう解釈できるか，あるいは解釈できないか．
2. $c$ を変えて，減少に転じる年がどう変わるかを調べる．2008年に減少へ転じさせるには $c$ をどうすればよいか．そのとき1970年までの当てはまりはどうなるか．
3. このモデルで誤差が下がったとしても，日本の人口減少の原因が増加率の線形な時間変化であると結論できるか．言えないとすれば，このモデルから言えることは何か．
````

## まとめ

- 指数成長モデルが外れた理由を，データから読み取った人口と推定された一人あたり増加率の負の関連と結び付けて考えた
- 一人あたりの増加率が $N$ の一次関数であり，$N=K$ で0になるという仮定を加えると，Logisticモデル $N' = rN(1 - N/K)$ が得られる．$r,K,N_0>0$ の場合，$K$ は正の解が長期的に収束する平衡人口である
- $1 - N/K$ は人口依存の相対増加率を内的増加率 $r$ で割った値であり，$N \ll K$ では指数成長と同じ，$N = K$ で変化なし，$N > K$ で減少を表す
- 2つのモデルは，同じデータ，同じ期間，同じ誤差指標で比較する．手で選んだパラメタでも，Logisticモデルの誤差は指数成長モデルの十数分の1になった
- Logisticモデルでも2010年以降の減少は表せない．拡張によって訓練誤差が減少しても，推定値の解釈や未使用期間の予測精度は別に評価する必要がある

## 課題

````{warning} 課題1：2つのモデルの比較図と採用理由

1. 指数成長モデル（第3回の $r$）と，Logisticモデル（$K = 12000$，$13000$，$15000$ 万人の3通り，$r$ はそれぞれ演習2で見つけた最も良い値）を，観測値と重ねた1枚の図に描き，`reports/figures/`に保存する．
2. 4つのモデルについて，全期間のMSE，1920〜1970年のMSE，1971〜2020年のMSE，2020年の値を表にする．
3. 表と図から，どのモデルを採用するかを決め，その理由を200字程度で書く．誤差の数値だけでなく，パラメタの意味と，モデルが表せないことにも触れること．
````

````{warning} 課題2：$K$ の解釈

Logisticモデルの $K$ を資源制約によって定まる平衡人口と解釈することについて，次の問いに200字程度で答える．

日本の人口が1億2800万人付近で頭打ちになった現象を，Logisticモデルは形として表せる．
しかしこの頭打ちを資源や空間の制約によって説明できると言えるか．
言えるとすればどのような根拠が必要か，言えないとすれば他にどのような要因が考えられ，それはモデルのどの部分の見直しにつながるか．

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

## 次回への接続

今回は $K$ と $r$ を手で数通り変えて，誤差が最も小さい組を探した．
演習2で経験したように，2つのパラメタが互いに影響し合うため，手で探すのは効率が悪く，本当に最も良い組を見つけたのか確信が持てない．
第5回では，パラメタの候補を格子状に並べ，すべての組み合わせについて誤差を計算して，目的関数の値をヒートマップで可視化する．
これを**パラメタサーチ**と呼ぶ．
今回作った`logistic_solution`，`mean_squared_error`，パラメタを変えるループは次回もそのまま使う．

## 自分の言葉で説明する問い

1. 指数成長モデルが1975年以降に外れた理由を，一人あたり増加率の図を使って説明せよ．
2. Logisticモデルの $1 - N/K$ という因子は，現象の何を表しているか．$N$ が $K$ に近いときと遠いときで説明せよ．
3. 拡張モデルの訓練誤差が減少しても，予測や現象の説明に適しているとは限らない理由を2つ挙げよ．
4. Logisticモデルは日本の人口の頭打ちを表せるが，2010年以降の減少は表せない．この事実は，次にどの仮定を見直すべきかについて何を示唆するか．
