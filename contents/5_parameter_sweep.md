# 第5回　パラメタサーチ

## 今回の位置付け

$$
\text{現象の理解}
\rightarrow
\text{仮定の設定}
\rightarrow
\text{数理モデルの構築}
\rightarrow
\text{数値シミュレーション}
\rightarrow
\text{データとの比較}
\rightarrow
\underline{\text{パラメタ推定}}
\rightarrow
\text{モデルの検証と改善}
$$

第4回では，Logisticモデルの $r$ と $K$ を手で数通り変え，誤差が小さい組を探した．
しかし，2つのパラメタは互いに影響し合い，手で探すだけでは「本当に最も良い組か」が分からなかった．

今回は，ワークフローの6段階目「パラメタ推定」の入口として，**パラメタサーチ**を行う．
パラメタの候補を格子状に並べ，すべての組み合わせについてモデルを計算して誤差を求め，誤差の地図を描く．
この方法は単純だが，誤差がパラメタに対してどのような形をしているかを目で見ることができ，第7回で学ぶ数値最適化の意味を理解する土台になる．

## 今回の到達目標

- 観測値とモデル予測の差から目的関数 $J(\theta)$ を定義し，その単位と意味を説明できる
- 1つのパラメタを系統的に変えて誤差曲線を描き，最小値の位置を読み取れる
- `for`文と`np.meshgrid`を使って2つのパラメタの格子上で多数のシミュレーションを実行できる
- 誤差のヒートマップを描き，最小値の位置と，谷の形からパラメタどうしの関係を読み取れる
- 探索範囲，刻み幅，計算量の関係を見積もれる
- データの期間によってパラメタが決まりにくくなる場合があること（識別可能性）を説明できる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第4回の復習，「手で探す」の限界（演習0） | 10分 |
| 2 | 目的関数の定義，1次元のパラメタサーチと誤差曲線 | 25分 |
| 3 | 2次元の格子，ヒートマップ，最小値の位置 | 20分 |
| 4 | 格子の刻みと計算量，谷の形と識別可能性（演習1〜3） | 35分 |
| 5 | 格子探索の限界と最適化への問い，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

第4回の演習2では，$K$ を3通り，$r$ を3通り変えて9個の誤差を表にした．
この表は，実は2次元のパラメタサーチを $3 \times 3$ の粗い格子で行ったものである．
今回はこれを，もっと細かい格子で，コードで系統的に行う．

記号を整理する．
モデルのパラメタをまとめて $\theta$ と書く．
Logisticモデルでは $\theta = (r, K)$ である．
観測値を $y_i$（時刻 $t_i$，$i = 1, \ldots, n$），パラメタ $\theta$ のもとでのモデルの予測を $\hat{y}(t_i; \theta)$ と書く．
第4回までの $N(t_i)$ と同じものだが，「$\theta$ を変えると予測が変わる」ことを明示するためにこの書き方を使う．

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第5回の作業フォルダを作成する．

```bash
mkdir -p ~/applied_programming_ii/05
cd ~/applied_programming_ii/05
mkdir -p notebooks reports/figures
```

2. `notebooks/parameter_sweep.ipynb`を新規作成する．

3. `05`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第5回

- 氏名：
- 学籍番号：

## 今日の目標

Logisticモデルの r と K を格子状に変えて誤差を計算し，誤差の地図から最も良い組を探す．

## 探索の記録

| 探索 | パラメタの範囲 | 刻み | 格子点の数 | 計算時間 | 最小のMSE | 最良の (r, K) |
| --- | --- | --- | --- | --- | --- | --- |

## 演習1〜3の記録

## 課題1

## 課題2の考察
```

4. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．今回は計算時間を測るために`time`も使う．

```python
import time
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm
from scipy.integrate import solve_ivp

PROJECT_DIR = Path.home() / "applied_programming_ii" / "05"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("人口データの有無:", (DATA_DIR / "population_japan.csv").exists())
```

5. 第3回と第4回で作った関数を再定義し，データを読み込む．

```python
def exponential_solution(t, N0, r, t0=0.0):
    """dN/dt = r N, N(t0) = N0 の解析解を返す．"""
    return N0 * np.exp(r * (t - t0))


def logistic_rhs(t, N, r, K):
    """Logisticモデル dN/dt = r N (1 - N/K) の右辺．"""
    return r * N * (1 - N / K)


def logistic_solution(t, N0, r, K, t0=0.0):
    """dN/dt = r N (1 - N/K), N(t0) = N0 の解析解を返す．"""
    return K / (1 + ((K - N0) / N0) * np.exp(-r * (t - t0)))


def mean_squared_error(y_obs, y_model):
    """観測値とモデル値の平均二乗誤差を返す．"""
    return np.mean((y_obs - y_model) ** 2)


population = pd.read_csv(DATA_DIR / "population_japan.csv")
population["population_10k"] = population["total_population_thousand"] / 10

year_obs = population["year"].to_numpy()
t_obs = (year_obs - 1920).astype(float)          # 1920年を t = 0 とする [年]
y_obs = population["population_10k"].to_numpy()  # 観測値 [万人]
N0 = y_obs[0]                                     # 1920年の人口 [万人]

print(f"観測値の数 n = {len(y_obs)}，初期値 N0 = {N0:.1f} 万人")
```
````

## 目的関数を定義する

### 誤差を1つの数にまとめる

パラメタ $\theta$ を与えるとモデルの予測 $\hat{y}(t_i; \theta)$ が決まり，観測値 $y_i$ との差が決まる．
その差の大きさを1つの数にまとめた関数を**目的関数**と呼び，$J(\theta)$ と書く．
今回は第3回で導入した平均二乗誤差を使う．

$$
J(\theta) = \frac{1}{n}\sum_{i=1}^{n}\left(y_i - \hat{y}(t_i; \theta)\right)^2
$$

| 記号 | 意味 | 単位 |
| --- | --- | --- |
| $\theta$ | パラメタの組．Logisticモデルでは $(r, K)$ | $r$ は1／年，$K$ は万人 |
| $y_i$ | 時刻 $t_i$ の観測値 | 万人 |
| $\hat{y}(t_i; \theta)$ | パラメタ $\theta$ のもとでのモデルの予測 | 万人 |
| $y_i - \hat{y}(t_i; \theta)$ | 残差 | 万人 |
| $J(\theta)$ | 目的関数（平均二乗誤差） | （万人）$^2$ |

差を2乗するのは，正負の残差が打ち消し合わないようにするためと，大きな残差をより重く数えるためである．
2乗の代わりに絶対値を使う指標もあるが，この講義では2乗を使う．
第7回で学ぶ最小二乗法も，同じ目的関数を最小にする方法である．

**パラメタサーチ**とは，$\theta$ の候補をたくさん用意し，それぞれについて $J(\theta)$ を計算して，最も小さくなる $\theta$ を探すことである．

### 予測と目的関数をコードにする

パラメタを引数にとって予測を返す関数と，目的関数を返す関数を用意する．
今回は解析解が分かっているので，予測には`logistic_solution`を使う．
解析解が分からないモデルでは`solve_ivp`を使うが，手順は同じである．

```python
def predict_logistic(theta, t, N0):
    """パラメタ theta = (r, K) のもとでのLogisticモデルの予測 y_hat(t; theta) を返す．"""
    r, K = theta
    return logistic_solution(t, N0, r, K)


def objective_logistic(theta, t, y, N0):
    """Logisticモデルの目的関数 J(theta)（平均二乗誤差）を返す．"""
    y_hat = predict_logistic(theta, t, N0)
    return mean_squared_error(y, y_hat)


# 第4回で手で選んだ値で確認する
theta_trial = (0.03, 15000.0)
print(f"J{theta_trial} = {objective_logistic(theta_trial, t_obs, y_obs, N0):.0f} （万人）^2")
```

第4回の表と同じ値が出る．
以後は，この`objective_logistic`を，いろいろな $\theta$ について何度も呼び出す．

## 1次元のパラメタサーチ

まず，パラメタが1つのモデルで練習する．
指数成長モデル $N' = rN$ の $r$ を，1920〜1970年の観測値に対して探す．
初期値は $N_0$ に固定し，$\theta = r$ だけを動かす．

```python
fit_mask = year_obs <= 1970
t_fit = t_obs[fit_mask]
y_fit = y_obs[fit_mask]

# 探索範囲と刻み幅
r_grid = np.linspace(0.005, 0.020, 151)     # 0.005 から 0.020 まで 0.0001 刻み

J_r = np.zeros_like(r_grid)
for i, r_value in enumerate(r_grid):
    y_hat = exponential_solution(t_fit, N0, r_value)
    J_r[i] = mean_squared_error(y_fit, y_hat)

i_best = np.argmin(J_r)
print(f"格子点の数: {len(r_grid)}")
print(f"最小の J = {J_r[i_best]:.0f} （万人）^2 at r = {r_grid[i_best]:.4f} /年")
```

第3回の2時点法（$r = 0.01234$）や対数線形法（$r = 0.01244$）と近い値が得られる．
対数線形法は「対数の差の2乗和」を最小にしていたのに対し，ここでは「人口そのものの差の2乗和」を最小にしているので，完全には一致しない．
何を目的関数にするかで最良のパラメタは少し変わる．

誤差曲線を描く．

```python
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(r_grid, J_r)
ax.plot(r_grid[i_best], J_r[i_best], marker="o", color="red", label=f"minimum: r = {r_grid[i_best]:.4f}")
ax.set_yscale("log")
ax.set_title("Objective function J(r) for the exponential model, 1920-1970")
ax.set_xlabel("r [1/year]")
ax.set_ylabel("J(r) = MSE [(10^4 persons)^2]")
ax.grid(True, which="both")
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "error_curve_r.png", dpi=150)
plt.show()
```

誤差曲線は谷の形をしており，谷底が最良の $r$ である．
縦軸を対数にしたのは，谷の底と両側で $J$ の大きさが100倍以上違うためである．
谷が鋭いほど，$r$ は精度よく決まる．

````{note} 演習1：探索範囲と刻み幅を変える

1. `r_grid`を`np.linspace(0.005, 0.020, 16)`（0.001刻み）に変えて実行する．最良の $r$ と最小の $J$ はどう変わるか．刻みが粗いと何が起きるか．
2. `r_grid`を`np.linspace(0.015, 0.030, 151)`に変えて実行する．最良の $r$ はどこになるか．この結果を見て「最良の $r$ は0.015だ」と結論してよいか．誤差曲線の形から判断する．
3. 探索範囲を決めるとき，どのような点に注意すべきかを`README.md`に2行で書く．
````

```{dropdown} 演習1の確認
- 刻みが粗いと，最良の $r$ は格子点のどれかに丸められ，真の谷底からずれる．最小の $J$ も少し大きくなる．
- 探索範囲が谷底を含まないと，最小値は範囲の端に現れる．誤差曲線が範囲の端で下がり続けているときは，谷底が範囲の外にある印である．端で最小になったら範囲を広げてやり直す．
- 探索範囲は，パラメタの意味から見て妥当な範囲を含み，誤差曲線が両端で上がっていることを確認する．刻みは，必要な精度に合わせて選ぶ．
```

## 2次元のパラメタサーチ

### 格子を作る

Logisticモデルの $\theta = (r, K)$ を2次元の格子上で探す．
$r$ の候補と $K$ の候補をそれぞれ配列で用意し，`np.meshgrid`ですべての組み合わせを作る．
まず粗い格子で，`solve_ivp`を使って計算時間を測る．

```python
r_coarse = np.linspace(0.01, 0.06, 21)          # 0.0025 刻み
K_coarse = np.linspace(10000.0, 20000.0, 21)    # 500 万人刻み

R_coarse, K_grid_coarse = np.meshgrid(r_coarse, K_coarse)
print("格子の形:", R_coarse.shape, "，格子点の数:", R_coarse.size)

J_coarse = np.zeros_like(R_coarse)

start = time.perf_counter()
for i in range(R_coarse.shape[0]):
    for j in range(R_coarse.shape[1]):
        sol = solve_ivp(logistic_rhs, (0.0, 100.0), [N0], t_eval=t_obs, args=(R_coarse[i, j], K_grid_coarse[i, j]))
        J_coarse[i, j] = mean_squared_error(y_obs, sol.y[0])
elapsed_coarse = time.perf_counter() - start

i_min, j_min = np.unravel_index(np.argmin(J_coarse), J_coarse.shape)
print(f"計算時間: {elapsed_coarse:.2f} 秒（1点あたり {1000 * elapsed_coarse / R_coarse.size:.1f} ミリ秒）")
print(f"最小の J = {J_coarse[i_min, j_min]:.0f} （万人）^2 at r = {R_coarse[i_min, j_min]:.4f}, K = {K_grid_coarse[i_min, j_min]:.0f}")
```

`np.meshgrid`が返す2つの配列は，同じ形をしていて，`R_coarse[i, j]`と`K_grid_coarse[i, j]`が格子点 $(i, j)$ の $r$ と $K$ を与える．
行方向（`i`）が $K$，列方向（`j`）が $r$ に対応する．
二重の`for`文で全格子点を回り，各点で1回ずつシミュレーションを実行する．

### 細かい格子

次に，同じ範囲を細かい格子で探す．
格子点が約1万点になるので，今回は解析解を使って高速に計算する．
解析解がないモデルでは`solve_ivp`を使うしかなく，計算時間は格子点の数に比例して増える．

```python
r_fine = np.linspace(0.01, 0.06, 101)           # 0.0005 刻み
K_fine = np.linspace(10000.0, 20000.0, 101)     # 100 万人刻み

R_fine, K_grid_fine = np.meshgrid(r_fine, K_fine)
J_fine = np.zeros_like(R_fine)

start = time.perf_counter()
for i in range(R_fine.shape[0]):
    for j in range(R_fine.shape[1]):
        J_fine[i, j] = objective_logistic((R_fine[i, j], K_grid_fine[i, j]), t_obs, y_obs, N0)
elapsed_fine = time.perf_counter() - start

i_min, j_min = np.unravel_index(np.argmin(J_fine), J_fine.shape)
r_best, K_best = R_fine[i_min, j_min], K_grid_fine[i_min, j_min]
print(f"格子点の数: {R_fine.size}，計算時間: {elapsed_fine:.2f} 秒")
print(f"最小の J = {J_fine[i_min, j_min]:.0f} （万人）^2 at r = {r_best:.4f}, K = {K_best:.0f}")
print(f"参考：粗い格子で solve_ivp を使った場合の1点あたりの時間で見積もると {R_fine.size * elapsed_coarse / R_coarse.size:.0f} 秒かかる")
```

最良の組は $r \approx 0.0275$／年，$K \approx 14800$ 万人で，$J$ は約11.5万（万人）$^2$，平方根は約340万人である．
第4回で手で見つけた $(0.03, 15000)$ より誤差が半分以下になった．

### ヒートマップを描く

$J(r, K)$ を色で表した図を**ヒートマップ**と呼ぶ．
`pcolormesh`に格子と $J$ の配列を渡す．
$J$ の値は最小付近と端で1000倍以上違うので，色の尺度を対数にする．

```python
fig, ax = plt.subplots(figsize=(7, 5))
mesh = ax.pcolormesh(R_fine, K_grid_fine, J_fine, norm=LogNorm(), shading="auto", cmap="viridis")
fig.colorbar(mesh, ax=ax, label="J(r, K) = MSE [(10^4 persons)^2]")
ax.plot(r_best, K_best, marker="x", color="red", markersize=10, label=f"minimum: r = {r_best:.4f}, K = {K_best:.0f}")
ax.plot(0.03, 15000.0, marker="o", color="white", markersize=7, label="hand-picked (session 4)")
ax.set_title("Objective function of the logistic model, 1920-2020")
ax.set_xlabel("r [1/year]")
ax.set_ylabel("K [10^4 persons]")
ax.legend(loc="upper right")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "heatmap_r_K.png", dpi=150)
plt.show()
```

ヒートマップには，左下から右上に向かって斜めに伸びる暗い谷が見える．
谷の底の最も暗い場所が最良の組である．

### 最良のパラメタで観測値と比べる

```python
y_best = predict_logistic((r_best, K_best), t_obs, N0)

fig, axes = plt.subplots(2, 1, figsize=(8, 7), sharex=True)
ax = axes[0]
ax.plot(year_obs, y_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
ax.plot(year_obs, y_best, label=f"logistic, grid search (r = {r_best:.4f}, K = {K_best:.0f})")
ax.plot(year_obs, predict_logistic((0.03, 15000.0), t_obs, N0), linestyle="--", label="logistic, hand-picked (r = 0.03, K = 15000)")
ax.set_title("Logistic model with grid-searched parameters")
ax.set_ylabel("Population [10^4 persons]")
ax.grid(True)
ax.legend()

ax = axes[1]
ax.plot(year_obs, y_obs - y_best, marker="o", markersize=2)
ax.axhline(0, color="black", linewidth=0.8)
ax.set_title("Residual: observed - model")
ax.set_xlabel("Year")
ax.set_ylabel("Residual [10^4 persons]")
ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "logistic_grid_best.png", dpi=150)
plt.show()
```

残差は全期間で数百万人以内に収まるが，1950〜1980年の正の残差と，2010年以降の負の残差は残っている．
これはパラメタの選び方の問題ではなく，第4回で見たLogisticモデルの構造の限界である．
どれだけ丁寧にパラメタを探しても，モデルに入っていない仕組みは再現できない．

````{note} 演習2：格子の刻みと計算量

1. 粗い格子（21×21）と細かい格子（101×101）の結果を，`README.md`の「探索の記録」の表に記入する．
2. 細かい格子を`np.linspace(..., 51)`（51×51）で実行し，最良の組と計算時間を表に加える．格子点の数と計算時間はどのような関係か．
3. `solve_ivp`を使った場合の1点あたりの時間から，101×101の格子を`solve_ivp`で計算した場合の時間を見積もる．パラメタが3つになり，各101点の格子を使ったら何秒になるか．
4. 最良の組の周りだけを細かく探す（例えば $r \in [0.025, 0.030]$，$K \in [14000, 16000]$）ことで計算量を減らせる．この方法の利点と注意点を1行ずつ書く．
````

## 探索結果を読む：谷の形と識別可能性

### 谷が斜めに伸びる意味

ヒートマップの谷は，$r$ と $K$ の軸に沿っているのではなく，斜めに伸びている．
$K$ を小さくすると $r$ を大きくして立ち上がりを補えば，誤差はあまり増えない．
つまり，$r$ と $K$ は互いに補い合う関係にあり，「$r$ を少し大きく，$K$ を少し小さく」した組と「$r$ を少し小さく，$K$ を少し大きく」した組は，データから見てほとんど区別がつかない．

谷が細長いほど，谷に沿った方向のパラメタの組は決まりにくい．
最良の組が1点に決まっていても，その周りの広い範囲が「ほぼ同じくらい良い」なら，最良の値をあまり信用してはいけない．
データからパラメタがどれだけ確かに決まるかを**識別可能性**と呼ぶ．

### データの期間を変えると谷はどう変わるか

パラメタを決めるのに1920〜1970年の観測値だけを使った場合の $J$ を計算してみる．
この期間の人口はまだ増え続けており，頭打ちの様子はデータに含まれていない．

```python
fit_mask = year_obs <= 1970
J_fit = np.zeros_like(R_fine)
for i in range(R_fine.shape[0]):
    for j in range(R_fine.shape[1]):
        J_fit[i, j] = objective_logistic((R_fine[i, j], K_grid_fine[i, j]), t_obs[fit_mask], y_obs[fit_mask], N0)

i_fit, j_fit = np.unravel_index(np.argmin(J_fit), J_fit.shape)
r_fit_best, K_fit_best = R_fine[i_fit, j_fit], K_grid_fine[i_fit, j_fit]
print(f"1920〜1970年で探した最良の組: r = {r_fit_best:.4f}, K = {K_fit_best:.0f}, J = {J_fit[i_fit, j_fit]:.0f}")
print(f"K の探索範囲の上端: {K_fine[-1]:.0f}")

fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
for ax, J_map, title, (r_m, K_m) in zip(
    axes,
    [J_fine, J_fit],
    ["fitted to 1920-2020", "fitted to 1920-1970"],
    [(r_best, K_best), (r_fit_best, K_fit_best)],
):
    mesh = ax.pcolormesh(R_fine, K_grid_fine, J_map, norm=LogNorm(), shading="auto", cmap="viridis")
    fig.colorbar(mesh, ax=ax, label="J [(10^4 persons)^2]")
    ax.plot(r_m, K_m, marker="x", color="red", markersize=10, label=f"minimum: r = {r_m:.4f}, K = {K_m:.0f}")
    ax.set_title(f"Objective function, {title}")
    ax.set_xlabel("r [1/year]")
    ax.set_ylabel("K [10^4 persons]")
    ax.legend(loc="upper right")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "heatmap_period_comparison.png", dpi=150)
plt.show()
```

1920〜1970年だけで探すと，最良の $K$ は探索範囲の上端に貼り付く．
谷は右下から左上へ長く伸び，$K$ を大きくして $r$ を小さくすれば誤差がほとんど変わらないまま，どこまでも $K$ を大きくできる．
頭打ちのデータが含まれていないので，データは「$K$ がどこにあるか」について情報を持っていない．
この状況では，$K$ は識別できない．

第3回で「1970年までのデータで2020年を外挿すると大きく外れる」ことを見たが，その理由をパラメタの側から見ると，「頭打ち前のデータからは環境収容力が決まらない」ということになる．

````{note} 演習3：谷の形を読む

1. 全期間で探した左の図で，$J$ が最小値の2倍以下になる範囲をおおまかに読み取り，$r$ と $K$ それぞれの幅を`README.md`に書く．どちらのパラメタが決めやすいか．
2. 1920〜1970年で探した右の図で，$K$ の探索範囲を`np.linspace(10000.0, 50000.0, 101)`に広げて実行する．最良の $K$ はどうなるか．
3. 「1970年時点で日本の環境収容力を推定せよ」と求められたら，どう答えるべきか．数値を1つ答えるのが適切かどうかを含めて，2〜3行で書く．
````

```{dropdown} 演習3の確認
- 全期間では，$J$ が最小値の2倍以下になる範囲は $r$ が0.021〜0.036程度，$K$ が13200〜17800程度である．どちらも決まるが，相対的な幅で見ると $r$ のほうが広く，$K$ のほうが決めやすい．
- 1920〜1970年では，$K$ の範囲を広げても最良の $K$ は再び上端に現れる．谷底が範囲の中にないためである．
- 頭打ち前のデータからは環境収容力は決まらない．「データが増加期しか含まないため $K$ は識別できず，$r$ と $K$ の組の候補は谷に沿って無数にある」と答えるのが誠実である．あえて示すなら，複数の $K$ に対する予測を並べて示す．
```

## 探索範囲，刻み幅，計算量

パラメタサーチを設計するとき，次の3つを決める必要がある．

| 決めること | 選び方 | 失敗したときの症状 |
| --- | --- | --- |
| 探索範囲 | パラメタの意味から妥当な範囲をとる | 最小値が範囲の端に現れる |
| 刻み幅 | 必要な精度に合わせる | 最良の値が格子に丸められる |
| 計算量 | 格子点の数 × 1点あたりの時間 | 終わらない |

格子点の数は，パラメタの数 $p$ と各パラメタの刻み数 $m$ に対して $m^p$ になる．
$m = 101$ なら，$p = 1$ で101点，$p = 2$ で約1万点，$p = 3$ で約100万点，$p = 4$ で約1億点である．
`solve_ivp`で1点あたり1ミリ秒かかるとすれば，$p = 3$ で約17分，$p = 4$ では1日以上かかる．今回のように解析解が使える場合でも，$p = 4$ では数十分かかる．
パラメタが4つ以上あるモデルでは，格子で全部を調べることは現実的でない．

計算量を減らす工夫はいくつかある．

- 粗い格子で谷のおおまかな位置を見つけ，その周りだけを細かい格子で探す
- 解析解や近似式があれば，`solve_ivp`の代わりに使う
- 意味のない範囲（例えば $K < N_0$，$r < 0$）を最初から除く

しかし，根本的には「格子の点を全部調べる」という方針そのものに限界がある．

## モデルの限界と改善の問い

パラメタサーチは，誤差の地図を丸ごと見ることができるという大きな利点を持つ．
谷の形から，パラメタの決まりやすさや，パラメタどうしの関係が分かる．
しかし，次の限界がある．

- 格子点の数がパラメタの数に対して爆発的に増える
- 刻み幅より細かい精度では値が決まらない
- 谷の形が分かるのは，範囲と刻みを適切に選べた場合に限られる

ヒートマップを見ると，谷の底に向かって色が滑らかに暗くなっている．
人が地図を見れば，「暗い方へ進めば谷底に着く」と分かる．
であれば，全部の点を計算する代わりに，適当な出発点から「$J$ が小さくなる方向へ少しずつ進む」ことを繰り返せば，はるかに少ない計算で谷底に到達できるはずである．

```{important} 第7回への問い
コンピュータに，$J(\theta)$ が最小になる $\theta$ を効率的に探させるには，どうすればよいか．
```

これが第7回で扱う**数値最適化**である．
`scipy.optimize`の関数は，まさにこの「暗い方へ進む」操作を自動化したものである．
その前に第6回では，人口とは別の題材，河川流量とダム貯水量に移り，観測データを入力として使うモデルを学ぶ．

## まとめ

- 目的関数 $J(\theta)$ は，パラメタ $\theta$ のもとでのモデル予測と観測値の差を1つの数にまとめたものである．今回は平均二乗誤差を使い，単位は（万人）$^2$ である
- 1つのパラメタなら，候補を並べて $J$ を計算し，誤差曲線の谷底を読めばよい．探索範囲の端で最小になったら，範囲を広げる
- 2つのパラメタでは，`np.meshgrid`と二重の`for`文で格子上の全点を計算し，ヒートマップで谷を見る．Logisticモデルでは $r \approx 0.0275$，$K \approx 14800$ 万人が最良で，手で選んだ組より誤差が半分以下になった
- 谷が斜めに細長いのは，$r$ と $K$ が補い合う関係にあるためである．頭打ち前のデータだけでは $K$ は識別できず，最良値が探索範囲の端に貼り付く
- 格子点の数は $m^p$ で増え，パラメタが3つ以上では格子探索は現実的でなくなる．効率的に最小値を探す方法が第7回の数値最適化である

## 課題

````{warning} 課題1：ヒートマップと最良パラメタでの当てはめ図

1. 全期間の観測値に対する $J(r, K)$ のヒートマップを，最良の組と第4回で手で選んだ組を印で示して作成し，`reports/figures/`に保存する．
2. 最良の組でのモデルと観測値を重ねた図，および残差の図を作成して保存する．
3. 「探索の記録」の表を完成させる．少なくとも粗い格子，細かい格子，最良の組の周りを細かく探した格子の3行を含める．
4. 最良の組の $K \approx 14800$ 万人は，日本の人口の実際の最大値（約12800万人）より2000万人大きい．この $K$ を「環境収容力」と解釈することの妥当性を，第4回の演習3を踏まえて100字程度で書く．
````

````{warning} 課題2：識別可能性についての考察

1920〜1970年の観測値だけで探したヒートマップを使って，次の問いに200字程度で答える．

このヒートマップから，1970年時点のデータでは $K$ が決まらないことが分かった．
それにもかかわらず，第3回の課題1では1950年までのデータで2020年の人口を予測した．
パラメタが識別できない状況で予測を示すとき，何を一緒に示すべきか．
「予測値を1つ示す」ことの問題点と，代わりにできることを述べる．

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

````{dropdown} 発展演習：初期値もパラメタにする

これまで初期値 $N_0$ は1920年の観測値に固定していた．
観測値にも誤差があるので，$N_0$ もパラメタとみなして $\theta = (r, K, N_0)$ の3次元で探すことができる．

1. $N_0$ の候補を`np.linspace(5400.0, 5800.0, 21)`とし，$r$ と $K$ の格子を21×21にして，三重の`for`文で $J$ を計算する（格子点は9261点）．計算時間を測る．
2. 最良の組の $r$，$K$ は，2次元で探した結果とどれだけ変わるか．
3. 同じ刻み数で101点ずつにした場合の計算時間を見積もる．
4. パラメタを1つ増やすことで得られるものと失うものを，1行ずつ書く．
````

## 次回への接続

第6回では，題材を人口から河川流量とダム貯水量に移す．
人口モデルでは変化率が状態変数だけで決まっていたが，ダムの貯水量は，外から流れ込む水と放流する水という**外部入力**によって変わる．
「蓄積量の変化＝流入量－流出量」という保存則からモデルを作り，観測された流入量と放流量の時系列をそのままモデルの入力として`solve_ivp`に渡す方法を学ぶ．
今回の目的関数とパラメタサーチは第7回で再登場し，格子を全部調べる代わりに`scipy.optimize`で最小値を探す．
`objective_logistic`のように「パラメタを受け取って誤差を返す関数」を書けるようにしておくことが，第7回への準備になる．

## 自分の言葉で説明する問い

1. 目的関数 $J(\theta)$ とは何か．「観測値」「予測」「残差」という言葉を使って説明せよ．
2. ヒートマップの谷が斜めに細長く伸びていることは，$r$ と $K$ についてどのような事実を表しているか．
3. 1920〜1970年の観測値だけでは $K$ が識別できない．その理由を，データに含まれている情報という観点から説明せよ．
4. 格子探索はなぜパラメタが増えると使えなくなるのか．また，ヒートマップの形は，代わりにどのような探し方ができそうだと示唆しているか．
