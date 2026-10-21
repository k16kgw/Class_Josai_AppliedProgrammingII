# 第5回　パラメタサーチ

### 今回の位置付け

1. 現象の理解
2. 仮定の設定
3. 数理モデルの構築
4. 数値シミュレーション
5. データとの比較
6. <span style="color:red">パラメタ推定</span>
7. モデルの検証と改善

- 第4回：Logisticモデルのパラメタを変え，観測値に対するMSEを比較した．
- **第5回**：候補を格子状に並べる**格子探索**により，探索範囲内でMSEが最小となる組を求める．
  - 探索結果の可視化：誤差曲線とヒートマップから，パラメタの関係を読む．
  - 推定の限界：探索範囲・刻み幅・データの期間が結果に与える影響を調べる．

### 到達目標

- 観測値とモデル予測の差から目的関数 $J(\theta)$ を定義し，その単位と意味を説明できる
- 1つのパラメタを系統的に変えて誤差曲線を描き，最小値の位置を読み取れる
- `for`文と`np.meshgrid`を使って2つのパラメタの格子上で多数のシミュレーションを実行できる
- 誤差のヒートマップを描き，最小値の位置と，谷の形からパラメタどうしの関係を読み取れる
- 探索範囲，刻み幅，計算量の関係を見積もれる
- データの期間によってパラメタが決まりにくくなる場合があること（識別可能性）を説明できる

<!--
**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第4回の復習，手動による候補選択の限界（演習0） | 10分 |
| 2 | 目的関数の定義，1次元のパラメタサーチと誤差曲線 | 25分 |
| 3 | 2次元の格子，ヒートマップ，最小値の位置 | 20分 |
| 4 | 格子の刻みと計算量，谷の形と識別可能性（演習1〜3） | 35分 |
| 5 | 格子探索の限界と最適化への問い，まとめ，課題の説明 | 15分 |
-->

## 準備

````{note} 演習0：作業フォルダとNotebookの準備

1. ターミナルで第5回の作業フォルダを作成せよ．

```bash
mkdir -p ~/applied_programming_ii/05
cd ~/applied_programming_ii/05
mkdir -p notebooks reports/figures
```

作成するディレクトリ構成は次のとおりである．`data`は各回で共通に使用する．

```text
applied_programming_ii/
├── data/
└── 05/
    ├── README.md
    ├── notebooks/
    │   └── parameter_sweep.ipynb
    └── reports/
        └── figures/
```

2. `notebooks/parameter_sweep.ipynb`を新規作成せよ．

3. `05`フォルダに`README.md`を作り，次の内容を記入せよ．

```markdown
# 応用プログラミングII 第5回

- 氏名：
- 学籍番号：

## 今日の目標

Logisticモデルの r と K を格子状に変えて誤差を計算し，目的関数のヒートマップから最も良い組を探す．

## 探索の記録

- 採用した探索範囲と刻み幅：
- 最良の (r, K) とMSE：
- 格子点数と計算時間の関係：

探索条件ごとの計算結果と比較図はNotebookに記録する．

## 演習1

- 変更した条件・計算結果：
- 図から読み取れる傾向：
- 考察：

## 演習2

- 変更した条件・計算結果：
- 図から読み取れる傾向：
- 考察：

## 演習3

- 変更した条件・計算結果：
- 図から読み取れる傾向：
- 考察：

## 課題1

## 課題2の考察
```

4. Notebookの最初のコードセルに以下を入力し，実行できることを確認せよ．今回は計算時間を測るために`time`も使う．

```python
import time
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm
from scipy.integrate import solve_ivp

plt.rcParams["font.family"] = "Hiragino Sans"  # 日本語表示用（macOS）

PROJECT_DIR = Path.home() / "applied_programming_ii" / "05"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("人口データの有無:", (DATA_DIR / "population_japan.csv").exists())
```
````

## 復習と今回の準備

- 第4回の演習3：$K$と$r$の候補ごとにMSEを計算し，$r$とMSEの関係を図にした．今回は候補を細かい格子に広げる．
- 解析解と誤差指標：`logistic_solution`と`mean_squared_error`を再利用する．初期値は1920年の観測人口に固定する．
- 記号：パラメタの組を$\theta=(r,K)$，時刻$t_i$の観測値を$y_i$，モデル値を$\hat{y}(t_i;\theta)$と書く．$\hat{y}$は第4回の$N(t_i)$に相当し，パラメタへの依存を明示した記号である．


### 既習関数と人口データの準備

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

## 目的関数の定義

### 誤差指標と目的関数

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

今回は候補を格子状に並べてすべて評価する**格子探索**（グリッドサーチ）を用いる．

### モデル予測と目的関数の実装

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

第4回のモデル比較で求めたMSEと同じ値が出る．
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

- コードの補足：`np.argmin`：配列の最小値の位置を返す．その位置で候補のパラメタと目的関数値を取り出す．

第3回の2時点からの推定（$r = 0.01234$）や対数線形法（$r = 0.01244$）と近い値が得られる．
対数線形法は観測値と予測値の対数の差の二乗和を最小にしていたのに対し，ここでは観測人口と予測人口の差の二乗和を最小にしているので，完全には一致しない．
何を目的関数にするかで最良のパラメタは少し変わる．

誤差曲線を描く．

```python
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(r_grid, J_r)
ax.plot(r_grid[i_best], J_r[i_best], marker="o", color="red", label=f"minimum: r = {r_grid[i_best]:.4f}")
ax.set_yscale("log")
ax.set_title("指数成長モデルの目的関数 J(r)（1920〜1970年）")
ax.set_xlabel("r [1/年]")
ax.set_ylabel("J(r) = MSE [(万人)²]")
ax.grid(True, which="both")
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "error_curve_r.png", dpi=150)
plt.show()
```

この探索範囲では，目的関数はある $r$ の近傍で最小値をとる．以降，最良のパラメタとは，評価した候補の中で目的関数値が最小のものを指す．
縦軸を対数にしたのは，谷の底と両側で $J$ の大きさが100倍以上違うためである．
最小値の近傍で目的関数の曲率が大きいほど，$r$ の変化に対する目的関数の変化も大きい．推定の不確かさを定量化するには，観測誤差の大きさなども考慮する必要がある．

````{note} 演習1：探索範囲と刻み幅を変える

1. `r_grid`を`np.linspace(0.005, 0.020, 16)`（0.001刻み）に変えて実行せよ．最良の $r$ と最小の $J$ はどう変わるか．刻みが粗いと何が起きるか．
2. `r_grid`を`np.linspace(0.015, 0.030, 151)`に変えて実行せよ．最良の $r$ はどこになるか．この結果を見て$r=0.015$ が探索範囲外も含めた最小化点だと結論してよいか．誤差曲線の形から判断せよ．
3. 探索範囲を決めるとき，どのような点に注意すべきかを`README.md`に2行で記せ．
````

```{visible-answer} 演習1の解答例
- 刻みが粗いと，選択できる $r$ は格子点に限られるため，連続的な探索範囲での最小化点と一致するとは限らない．最小の $J$ も少し大きくなる．
- 探索範囲が谷底を含まないと，最小値は範囲の端に現れる．誤差曲線が範囲の端で下がり続けているときは，谷底が範囲の外にある印である．端で最小になったら範囲を広げてやり直す．
- 探索範囲は，パラメタの意味から見て妥当な範囲を含み，誤差曲線が両端で上がっていることを確認する．刻みは，必要な精度に合わせて選ぶ．
```

## 2次元のパラメタサーチ

### 探索格子の作成

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

```{dropdown} コードの補足：格子上の計算

- `np.meshgrid`：2つの候補配列から，同じ形の格子座標を作る．`R_coarse[i, j]`と`K_grid_coarse[i, j]`が同じ格子点の$r$と$K$を与える．
- 行と列の対応：行番号`i`が$K$，列番号`j`が$r$に対応し，二重の`for`文で全ての組を計算する．
- `np.unravel_index`：最小値の1次元の位置番号を，格子の行番号と列番号に変換する．
- `time.perf_counter()`：計算の前後で取得した値の差から，経過時間を秒単位で求める．
```

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

### ヒートマップの描画

$J(r, K)$ を色で表した図を**ヒートマップ**と呼ぶ．
`pcolormesh`に格子と $J$ の配列を渡す．
$J$ の値は最小付近と端で1000倍以上違うので，色の尺度を対数にする．

```python
fig, ax = plt.subplots(figsize=(7, 5))
mesh = ax.pcolormesh(R_fine, K_grid_fine, J_fine, norm=LogNorm(), shading="auto", cmap="viridis")
fig.colorbar(mesh, ax=ax, label="J(r, K) = MSE [(万人)²]")
ax.plot(r_best, K_best, marker="x", color="red", markersize=10, label=f"minimum: r = {r_best:.4f}, K = {K_best:.0f}")
ax.plot(0.03, 15000.0, marker="o", color="white", markersize=7, label="hand-picked (session 4)")
ax.set_title("Logisticモデルの目的関数（1920〜2020年）")
ax.set_xlabel("r [1/年]")
ax.set_ylabel("K [万人]")
ax.legend(loc="upper right")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "heatmap_r_K.png", dpi=150)
plt.show()
```

- コードの補足：`LogNorm()`：色の尺度を対数にする．`fig.colorbar`は色と目的関数値の対応を示す．

ヒートマップには，目的関数値の小さい格子点が帯状に分布する領域が見られる．このノートでは，この低値領域を目的関数の谷と呼ぶ．
その中で目的関数値が最小の格子点が，今回の探索で選ばれるパラメタの組である．

### 最良パラメタによる観測値との比較

```python
y_best = predict_logistic((r_best, K_best), t_obs, N0)
```

```python
fig, axes = plt.subplots(2, 1, figsize=(8, 7), sharex=True)
ax = axes[0]
ax.plot(year_obs, y_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
ax.plot(year_obs, y_best, label=f"logistic, grid search (r = {r_best:.4f}, K = {K_best:.0f})")
ax.plot(year_obs, predict_logistic((0.03, 15000.0), t_obs, N0), linestyle="--", label="logistic, hand-picked (r = 0.03, K = 15000)")
ax.set_title("格子探索で推定したLogisticモデル")
ax.set_ylabel("人口 [万人]")
ax.grid(True)
ax.legend()

ax = axes[1]
ax.plot(year_obs, y_obs - y_best, marker="o", markersize=2)
ax.axhline(0, color="black", linewidth=0.8)
ax.set_title("残差（観測値−モデル値）")
ax.set_xlabel("年")
ax.set_ylabel("残差 [万人]")
ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "logistic_grid_best.png", dpi=150)
plt.show()
```

残差は全期間で数百万人以内に収まるが，1950〜1980年の正の残差と，2010年以降の負の残差は残っている．
これはパラメタの選び方の問題ではなく，第4回で見たLogisticモデルの構造の限界である．
どれだけ丁寧にパラメタを探しても，モデルに入っていない仕組みは再現できない．

````{note} 演習2：格子の刻みと計算量

1. 粗い格子（21×21）と細かい格子（101×101）の探索範囲・最良の組・MSE・計算時間をNotebookに記録せよ．
2. 解析解を用いる細かい格子のコードを，21×21，51×51，101×101で実行せよ．横軸を格子点数，縦軸を計算時間とする図を描き，両者の関係を`README.md`に記せ．本文の`ax.plot`に，記録した格子点数のリストと計算時間のリストを渡せばよい．
3. `solve_ivp`を使った場合の1点あたりの時間から，101×101の格子を`solve_ivp`で計算した場合の時間を見積もれ．パラメタが3つになり，各101点の格子を使ったら何秒になるか．
4. 最良の組の周りだけを細かく探す（例えば $r \in [0.025, 0.030]$，$K \in [14000, 16000]$）ことで計算量を減らせる．この方法の利点と注意点を1行ずつ記せ．
````

## 探索結果の解釈：谷の形と識別可能性

### 谷が斜めに伸びる意味

ヒートマップの谷は，$r$ と $K$ の軸に沿っているのではなく，斜めに伸びている．
$K$ を小さくすると $r$ を大きくして立ち上がりを補えば，誤差はあまり増えない．
つまり，$r$ と $K$ は互いに補い合う関係にあり，$r$ を増やし $K$ を減らした組と，$r$ を減らし $K$ を増やした組は，データから見てほとんど区別がつかない．

谷が細長いほど，谷に沿った方向のパラメタの組は決まりにくい．
最小値を与える格子点が1つでも，広い範囲のパラメタが近い目的関数値を与える場合，データの小さな変化によって推定値が大きく変わる可能性がある．
異なるパラメタの組をモデルの出力から区別できる性質を**識別可能性**と呼ぶ．ここで検討するのは，有限個で誤差を含む観測データからパラメタを十分な精度で区別できるかという，実用的な識別可能性である．

### 観測期間による目的関数の分布の変化

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
```

```python
fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
for ax, J_map, title, (r_m, K_m) in zip(
    axes,
    [J_fine, J_fit],
    ["推定期間：1920〜2020年", "推定期間：1920〜1970年"],
    [(r_best, K_best), (r_fit_best, K_fit_best)],
):
    mesh = ax.pcolormesh(R_fine, K_grid_fine, J_map, norm=LogNorm(), shading="auto", cmap="viridis")
    fig.colorbar(mesh, ax=ax, label="J [(万人)²]")
    ax.plot(r_m, K_m, marker="x", color="red", markersize=10, label=f"minimum: r = {r_m:.4f}, K = {K_m:.0f}")
    ax.set_title(f"目的関数（{title}）")
    ax.set_xlabel("r [1/年]")
    ax.set_ylabel("K [万人]")
    ax.legend(loc="upper right")
fig.tight_layout()
fig.savefig(FIGURE_DIR / "heatmap_period_comparison.png", dpi=150)
plt.show()
```

1920〜1970年だけで探すと，目的関数が最小となる $K$ は探索範囲の上端に位置する．
谷は右下から左上へ長く伸び，$K$ を大きくして $r$ を小さくすれば誤差がほとんど変わらないまま，今回調べた範囲では大きな $K$ も同程度の適合度を与える．
飽和に近い状態の観測が少ないため，このデータと探索結果から $K$ の上限を十分に制約することは難しい．
この結果は $K$ の実用的な識別可能性の不足を示すが，モデルの構造上 $K$ を識別できないことの証明ではない．

第3回の指数成長モデルの外挿誤差は，一定の増加率という仮定の限界を示した．Logisticモデルに拡張しても，推定期間に飽和に近い観測が少なければ $K$ の不確かさが大きく，長期予測も不確かになる．

````{note} 演習3：谷の形を読む

1. 全期間で探した左の図で，$J$ が最小値の2倍以下になる範囲をおおまかに読み取り，$r$ と $K$ それぞれの幅を`README.md`に記せ．どちらのパラメタが決めやすいか．
2. 1920〜1970年で探した右の図で，$K$ の探索範囲を`np.linspace(10000.0, 50000.0, 101)`に広げて実行せよ．最良の $K$ はどうなるか．
3. 1970年までのデータからLogisticモデルの環境収容力を推定するよう求められたら，どう答えるべきか．数値を1つ答えるのが適切かどうかを含めて，2〜3行で記せ．
````

```{visible-answer} 演習3の解答例
- 全期間では，$J$ が最小値の2倍以下になる範囲は $r$ が0.021〜0.036程度，$K$ が13200〜17800程度である．いずれも低値領域に対応する範囲を読み取れるが，相対的な幅で見ると $r$ のほうが広く，$K$ のほうが決めやすい．
- 1920〜1970年では，$K$ の範囲を広げても最良の $K$ は再び上端に現れる．谷底が範囲の中にないためである．
- このデータでは $K$ の推定値が探索上限に依存し，十分な精度で定まらないことを報告する．低値領域に複数の候補があるため，単一の推定値に過度な精度を与えない．あえて示すなら，複数の $K$ に対する予測を並べて示す．
```

## 探索範囲，刻み幅，計算量

パラメタサーチを設計するとき，次の3つを決める必要がある．

| 決めること | 選び方 | 失敗したときの症状 |
| --- | --- | --- |
| 探索範囲 | パラメタの意味から妥当な範囲をとる | 最小値が範囲の端に現れる |
| 刻み幅 | 必要な精度に合わせる | 最良の値が格子に丸められる |
| 計算時間 | 格子点の数 × 1点あたりの平均計算時間 | 利用可能な計算時間を超える |

格子点の数は，パラメタの数 $p$ と各パラメタの刻み数 $m$ に対して $m^p$ になる．
$m = 101$ なら，$p = 1$ で101点，$p = 2$ で約1万点，$p = 3$ で約100万点，$p = 4$ で約1億点である．
`solve_ivp`で1点あたり1ミリ秒かかるとすれば，$p = 3$ で約17分，$p = 4$ では1日以上かかる．今回のように解析解が使える場合でも，$p = 4$ では数十分かかる．
この刻み数と評価時間では，4パラメタの格子探索は講義時間内に完了しない．実行可能性はパラメタ数だけでなく，格子点数と1点あたりの計算時間に依存する．

計算量を減らす工夫はいくつかある．

- 粗い格子で谷のおおまかな位置を見つけ，その周りだけを細かい格子で探す
- 解析解や近似式があれば，`solve_ivp`の代わりに使う
- 採用した仮定と整合しない範囲を除く．例えば正の内的自然増加率で人口増加を表す場合は $r>0$，$K>N_0$ に制限する．$K<N_0$ は減少を表す場合には意味を持つ

しかし，根本的には全格子点で目的関数を評価する方針そのものに限界がある．

## モデルの限界と改善の問い

パラメタサーチでは，指定した範囲と刻み幅における目的関数の分布を確認できる．
谷の形から，パラメタの決まりやすさや，パラメタどうしの関係が分かる．
しかし，次の限界がある．

- 格子点の数がパラメタの数に対して爆発的に増える
- 刻み幅より細かい精度では値が決まらない
- 谷の形が分かるのは，範囲と刻みを適切に選べた場合に限られる

ヒートマップを見ると，谷の底に向かって色が滑らかに暗くなっている．
局所的な目的関数の変化を利用してパラメタを逐次更新すれば，全格子点を評価せずに極小値を探索できる．
ただし，得られる点が探索範囲全体の最小値を与えるとは限らず，探索の初期値や停止条件にも依存する．

```{tip} 第7回への問い
コンピュータに，$J(\theta)$ が最小になる $\theta$ を効率的に探させるには，どうすればよいか．
```

これが第7回で扱う**数値最適化**である．
第7回では，残差とそのパラメタに対する変化を利用する最小二乗法の数値最適化を扱う．
その前に第6回では，人口とは別の題材，河川流量とダム貯水量に移り，観測データを入力として使うモデルを学ぶ．

## まとめ

- 目的関数：観測値とモデル値の差をMSEにまとめ，候補を比較する．
- 格子探索：1次元では誤差曲線，2次元ではヒートマップから，格子上の最小値とパラメタの関係を読む．
- 推定の限界：結果は探索範囲・刻み幅・観測期間に依存し，パラメタ数が増えると計算量も増える．
- 次回：河川流量とダム貯水量を題材に，保存則と観測データを外部入力とするモデルを扱う．格子探索は第7回の数値最適化につながる．

```{dropdown} 復習用の確認事項

1. 目的関数 $J(\theta)$ とは何か．観測値・予測値・残差という用語を使って説明せよ．
2. ヒートマップの谷が斜めに細長く伸びていることは，$r$ と $K$ についてどのような事実を表しているか．
3. 今回の1920〜1970年の観測値による探索では，$K$ を十分な精度で推定できなかった．その理由を，データに含まれている情報という観点から説明せよ．
4. 格子探索はなぜパラメタが増えると使えなくなるのか．また，ヒートマップの形は，代わりにどのような探し方ができそうだと示唆しているか．
```

## 課題

````{warning} 課題1：ヒートマップと最良パラメタでの当てはめ図

1. 全期間の観測値に対する $J(r, K)$ のヒートマップを，最良の組と第4回で手で選んだ組を印で示して作成し，`reports/figures/`に保存せよ．
2. 最良の組でのモデルと観測値を重ねた図，および残差の図を作成して保存せよ．
3. 最良の組の周囲をさらに細かく探索し，細かい格子での結果とMSEを比較せよ．Notebookに比較図を示し，採用した探索範囲・刻み幅・最良の組・MSEを`README.md`の「探索の記録」に記せ．
4. 最良の組の $K \approx 14800$ 万人は，日本の人口の実際の最大値（約12800万人）より2000万人大きい．この推定値が実際の資源制約による環境収容力を表すと解釈することの妥当性を，第4回の演習3を踏まえて100字程度で記せ．
````

````{warning} 課題2：識別可能性についての考察

1920〜1970年の観測値だけで探したヒートマップを使って，次の問いに200字程度で答えよ．

このヒートマップから，1970年までのデータでは $K$ を十分な精度で推定できないことが示唆された．
それにもかかわらず，第3回の課題1では1950年までのデータで2020年の人口を予測した．
パラメタが識別できない状況で予測を示すとき，何を一緒に示すべきか．
単一の予測値のみを示すことの問題点と，代わりにできることを述べよ．
````

### 提出先・期限

- 提出場所：WebClass「第5回課題」
- 提出物：
  - `README.md`
  - Notebookファイル`parameter_sweep.ipynb`
- 提出期限：2026年10月31日(土)23:59

## 自主学習用の発展課題

任意で取り組み，結果をNotebookに追記せよ．

### 初期値を含むパラメタ推定

これまで初期値 $N_0$ は1920年の観測値に固定していた．
観測値にも誤差があるので，$N_0$ もパラメタとみなして $\theta = (r, K, N_0)$ の3次元で探すことができる．

````{note} 発展課題：初期値もパラメタにする

1. $N_0$ の候補を`np.linspace(5400.0, 5800.0, 21)`とし，$r$ と $K$ の格子を21×21にして，三重の`for`文で $J$ を計算する（格子点は9261点）．計算時間を測定せよ．
2. 最良の組の $r$，$K$ は，2次元で探した結果とどれだけ変わるか．
3. 同じ刻み数で101点ずつにした場合の計算時間を見積もれ．
4. パラメタを1つ増やすことで得られるものと失うものを，1行ずつ記せ．
````
