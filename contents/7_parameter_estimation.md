# 第7回　パラメタ推定

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

第5回では，Logisticモデルのパラメタ $r$ と $K$ を格子状に変えて誤差を計算し，ヒートマップの谷の底を目で探した．
格子を全部計算する方法は確実だが，パラメタが3つ，4つと増えると計算量が爆発する．
今回は，目的関数の値や局所的な変化を利用し，パラメタを逐次更新する**数値最適化**を使い，観測データからパラメタを推定する．
併せて，推定に使うデータと検証に使うデータを分ける考え方を導入する．

## 今回の到達目標

- 観測値 $y_i$ とモデル予測 $\hat{y}(t_i;\theta)$ の差から，パラメタ $\theta$ の関数としての目的関数を定義できる
- パラメタサーチ（格子の全探索）と数値最適化（局所的な情報を用いた反復探索）の関係を説明できる
- `scipy.optimize.least_squares`を使って微分方程式モデルのパラメタを推定し，結果の妥当性を確認できる
- 初期値依存性，パラメタの範囲指定，局所解の問題を具体例で説明できる
- データを訓練期間と検証期間に分け，当てはまりの良さと予測の良さが別であることを示せる
- 推定値だけでなく，データ，推定モデル，残差を可視化して報告できる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第5回のヒートマップの復習，格子探索の限界（演習0） | 10分 |
| 2 | 残差と目的関数，最小二乗法，最適化の考え方 | 25分 |
| 3 | `least_squares`によるLogisticモデルの推定，初期値と範囲の指定 | 20分 |
| 4 | 訓練・検証の分割，残差の可視化，ダムデータへの応用（演習1〜4） | 35分 |
| 5 | 推定と検証の区別，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

第6回では，保存則 $V' = Q_{\mathrm{in}}(t) - Q_{\mathrm{out}}(t)$ にパラメタはなかったが，貯水位と貯水量の線形換算には傾き約627千m³/mを用いた．
この数はダムの諸元から仮定した値であり，データに合うように決めたものではない．
今回はまず，第3回から第5回まで使ってきた人口データとLogisticモデルで推定の手順を確認し，その後で第6回の換算の傾きをデータから推定する．

第5回で作ったヒートマップは，パラメタ平面の各点で誤差を計算し，最も小さい点を探すものだった．
今回は，目的関数を減少させるようにパラメタを反復更新し，設定した停止条件を満たした時点で計算を終了する．
局所的な最適化では，探索の初期値によって異なる極小点に到達したり，十分に目的関数が減少する前に停止したりすることがある．

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第7回の作業フォルダを作成する．

```bash
mkdir -p ~/applied_programming_ii/07
cd ~/applied_programming_ii/07
mkdir -p notebooks reports/figures
```

2. `~/applied_programming_ii/data/`に`population_japan.csv`と`dam_urayama_daily.csv`があることを確認する．なければ[授業用データ一覧](../data/README.md)からダウンロードする．

3. `notebooks/parameter_estimation.ipynb`を新規作成する．

4. `07`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第7回

- 氏名：
- 学籍番号：

## 今日の目標

観測データからモデルのパラメタを最小二乗法で推定し，訓練期間と検証期間の誤差を比べて結果を評価する．

## 推定条件

- モデル：
- 推定するパラメタ：
- 目的関数：
- 訓練期間：
- 検証期間：
- 初期値：
- パラメタの範囲：

## 演習1：初期値を変えた結果

| 初期値 (r, K) | 推定値 r | 推定値 K | 目的関数の値 | 評価回数 |
| --- | --- | --- | --- | --- |

## 演習2・3の記録

## 演習4：ダムの換算の傾き

## 課題1

## 課題2の考察
```

5. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．今回から`scipy.optimize`を使う．

```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

PROJECT_DIR = Path.home() / "applied_programming_ii" / "07"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("人口データの有無:", (DATA_DIR / "population_japan.csv").exists())
print("ダムデータの有無:", (DATA_DIR / "dam_urayama_daily.csv").exists())
```
````

## 導入：格子探索の限界

第5回では，各パラメタを21通りまたは101通りに変えてヒートマップを作った．ここでは計算量の例として，各50通りの候補なら $50\times50=2500$ 回のモデル評価が必要になることを考える．
もし初期値 $N_0$ も未知として3つ目のパラメタにすると $50^3 = 125000$ 回，第11回のSIRモデルのように4つのパラメタがあれば $50^4 = 6250000$ 回になる．
1回のシミュレーションが0.01秒でも，4パラメタの格子には17時間かかる．

数値最適化では，現在のパラメタの近傍で残差がどう変化するかを利用して更新量を決める．
この方法では評価回数を格子探索より大幅に減らせる場合がある．ただし，必要な計算量はパラメタ数だけでなく，目的関数の性質や停止条件にも依存する．

人口データとLogisticモデルを読み込んで準備する．

```python
population = pd.read_csv(DATA_DIR / "population_japan.csv")
population["population_10k"] = population["total_population_thousand"] / 10

# 観測時刻は1920年を0とした年数，観測値は万人
t_obs = (population["year"] - 1920).values.astype(float)
y_obs = population["population_10k"].values
N0 = y_obs[0]

print("観測点の数:", len(t_obs), " 期間:", population["year"].min(), "〜", population["year"].max())
print(f"初期値 N0 = {N0:.1f} 万人")
```

```python
def logistic_rhs(t, N, r, K):
    """Logisticモデル dN/dt = r N (1 - N/K) の右辺．"""
    return r * N * (1 - N / K)


def simulate_logistic(theta, t_eval, N0):
    """パラメタ theta = (r, K) でLogisticモデルを解き，時刻 t_eval での N を返す．"""
    r, K = theta
    sol = solve_ivp(logistic_rhs, (t_eval[0], t_eval[-1]), [N0], t_eval=t_eval, args=(r, K), rtol=1e-6)
    return sol.y[0]


def mean_squared_error(y_true, y_pred):
    """平均二乗誤差 (1/n) sum (y_true - y_pred)^2 を返す．"""
    return np.mean((y_true - y_pred) ** 2)


# 第5回のヒートマップで谷の底の近くにあった値
theta_grid = (0.028, 14800.0)
mse_grid = mean_squared_error(y_obs, simulate_logistic(theta_grid, t_obs, N0))
print(f"格子探索で見つけた (r, K) = {theta_grid}: MSE = {mse_grid:.1f} （RMSE = {np.sqrt(mse_grid):.1f} 万人）")
```

## 残差と目的関数

### 残差

観測時刻 $t_i$ における観測値を $y_i$，パラメタ $\theta$ のモデルが与える予測を $\hat{y}(t_i;\theta)$ とする．
その差

$$
e_i(\theta) = \hat{y}(t_i;\theta) - y_i
\qquad (i = 1, \ldots, n)
$$

を**残差**と呼ぶ．
残差は観測点の数だけあり，パラメタを変えると全部が変わる．
当てはまりの程度を評価するため，残差ベクトルの大きさを目的関数で定量化する．第3〜5回の図では観測値から予測値を引いたが，本節の最適化関数では逆の符号を採用する．符号を全体で反転しても二乗和と推定値は変わらない．

### 目的関数と最小二乗法

残差をまとめて1つの数にしたものが目的関数である．
最もよく使われるのは残差の二乗和で，

$$
J(\theta) = \sum_{i=1}^{n} e_i(\theta)^2 = \sum_{i=1}^{n} \left( \hat{y}(t_i;\theta) - y_i \right)^2
$$

である．
これを最小にする $\theta$ を選ぶ方法を**最小二乗法**と呼ぶ．
第5回で使った平均二乗誤差 MSE は $J(\theta)/n$ であり，$n$ は定数なので，MSE を最小にする $\theta$ と $J$ を最小にする $\theta$ は同じである．

二乗を使う理由は，正負の残差が打ち消し合わないこと，大きな残差が目的関数値に与える寄与を大きくすること，そして微分ができて最適化の計算に向くことである．
一方で，1つの大きな外れ値に結果が引きずられやすいという欠点もある．

### パラメタの選び方が結果を決める

$J(\theta)$ は，$\theta$ を入力，誤差を出力とする関数である．
第5回のヒートマップは，この関数を $(r, K)$ 平面の上に描いたものにほかならない．
今回はこの関数の最小値を，`scipy.optimize.least_squares`に探させる．

```{tip} 目的関数の設計はモデル化の一部である
残差の二乗和は標準的だが，唯一の選択ではない．
人口のように値の桁が変わるデータでは，相対誤差 $(\hat{y}_i - y_i)/y_i$ を使う方が適切なこともある．
観測の信頼度が時期によって違うなら，重みを付けることもできる．
どの目的関数を使うかは，データの性質と目的から決める判断であり，結果に影響する．
```

## `least_squares`によるパラメタ推定

### 残差を返す関数

`least_squares`は，残差のベクトルを返す関数を受け取り，その二乗和を最小にするパラメタを探す．
目的関数を自分で計算する必要はなく，残差の配列を返せばよい．
関数の第1引数は推定するパラメタの配列，それ以降は`args`で渡す固定の情報である．

```python
def residuals(theta, t_obs, y_obs, N0):
    """パラメタ theta = (r, K) におけるLogisticモデルの残差ベクトル（モデル - 観測）を返す．"""
    return simulate_logistic(theta, t_obs, N0) - y_obs
```

### 推定を実行する

出発点となる初期値を与えて実行する．
第5回の格子探索で見当を付けた値を使う．

```python
theta_initial = [0.03, 13000.0]

result = least_squares(residuals, theta_initial, args=(t_obs, y_obs, N0))

r_hat, K_hat = result.x
print("収束したか:", result.success, " 状態:", result.message)
print(f"推定値: r = {r_hat:.5f} /年,  K = {K_hat:.1f} 万人")
print(f"目的関数（残差二乗和の半分）: {result.cost:.1f}")
print(f"RMSE: {np.sqrt(np.mean(result.fun ** 2)):.1f} 万人")
print(f"残差関数の評価回数: {result.nfev}")
```

`result`の主な属性を整理する．

| 属性 | 意味 |
| --- | --- |
| `result.x` | 推定されたパラメタの配列 |
| `result.fun` | 推定値における残差ベクトル |
| `result.cost` | 目的関数の値．`least_squares`では残差二乗和の半分 |
| `result.nfev` | 残差関数を評価した回数 |
| `result.success` | 指定した停止条件が満たされたか．大域的最小値への到達は保証しない |
| `result.message` | 終了理由 |

残差関数の評価回数が10回足らずであることに注目する．
各50候補の格子探索なら2500回のモデル評価が必要になる．
数値最適化では全格子点を評価しない．なお，`result.nfev`に数値微分のための評価が含まれるかは実装・バージョンによるため，実測時間も併せて比較する．

### 初期値依存性

数値最適化の結果は探索の初期値に依存し，異なる極小点や停止点に到達することがある．ここでの初期値はパラメタ探索の開始値であり，微分方程式の初期条件とは区別する．
複数の初期値から始めて結果が一致するかを確かめるのが基本の作法である．

````{note} 演習1：初期値を変えて推定する

```python
initial_guesses = [
    [0.03, 13000.0],
    [0.01, 20000.0],
    [0.10, 10000.0],
    [0.05, 30000.0],
]

print(f"{'初期値 (r, K)':>22} {'推定 r':>10} {'推定 K':>10} {'cost':>12} {'評価回数':>8}")
for guess in initial_guesses:
    res = least_squares(residuals, guess, args=(t_obs, y_obs, N0))
    print(f"{str(guess):>22} {res.x[0]:10.5f} {res.x[1]:10.1f} {res.cost:12.1f} {res.nfev:8d}")
```

1. 結果を`README.md`の「演習1」の表に転記する．
2. 4つの初期値から同じ推定値に到達したか．評価回数はどう違うか．
3. 初期値`[0.5, 6000.0]`を追加して実行する．何が起きるか．推定値と cost を他の結果と比べる．
````

```{dropdown} 演習1の確認
4つの初期値のうち3つからは，いずれも $r \approx 0.0276$，$K \approx 14750$ に到達する．
評価回数は初期値によって6回から10回程度で，到達点は同じである．

一方，初期値`[0.1, 10000.0]`からは，$K$ が10000のまま動かず，cost が約27倍大きい点で停止条件を満たして終了する場合がある．
初期値`[0.5, 6000.0]`ではさらに悪く，$K$ が初期人口5596万人に近い値に留まったまま評価回数の上限に達する．
$K$ が初期人口に近いと，人口は最初からほとんど増えない解になり，そこから $K$ を少し動かしても誤差がほとんど変わらないため，数値微分で残差の変化を十分に捉えられない場合がある．
この終了結果だけでは，局所的な極小点なのか，スケーリングや数値微分に起因する停止なのかを区別できない．`success`だけでなく，目的関数値，終了理由，初期値を変えた結果を確認する．
```

### パラメタの範囲を指定する

パラメタには，モデルの意味から決まる範囲がある．
ここでは正の内的増加率で人口増加を表すため，$r>0$，$K>N_0$ に制限する．減少を対象とする場合には別の範囲が適切なこともある．
`bounds`で範囲を指定すると，設定した仮定と整合しない範囲での探索を防げる．

```python
lower_bounds = [0.0, 6000.0]       # r >= 0, K >= 6000 万人
upper_bounds = [1.0, 50000.0]      # r <= 1, K <= 50000 万人

result_bounded = least_squares(residuals, [0.5, 6000.0], args=(t_obs, y_obs, N0), bounds=(lower_bounds, upper_bounds))
print(f"範囲を指定した場合: r = {result_bounded.x[0]:.5f}, K = {result_bounded.x[1]:.1f}, cost = {result_bounded.cost:.1f}")
```

範囲を指定しても，局所解の問題が完全に消えるわけではない．
複数の初期値を試すこと，第5回のような粗い格子探索で全体の地形を見ておくことが，最適化の前の準備として有効である．

## 訓練期間と検証期間

### 全データで推定してはいけないのか

ここまでは1920年から2020年の全データを使って推定した．
推定では訓練データの残差を小さくするようパラメタを選ぶ．したがって，訓練誤差だけでは未使用データに対する予測精度を評価できない．

モデルが本当に現象を捉えているかを確かめるには，パラメタを決めるのに**使わなかった**データで予測を試す必要がある．
そのために，データを次の2つに分ける．

- **訓練期間**：パラメタの推定に使う期間
- **検証期間**：推定したモデルの予測を観測と比べる期間

時系列データでは，過去を訓練，未来を検証にするのが自然である．
ここでは1990年までを訓練，1995年から2020年を検証とする．

```python
train_mask = population["year"] <= 1990
valid_mask = population["year"] >= 1995

t_train, y_train = t_obs[train_mask], y_obs[train_mask]
t_valid, y_valid = t_obs[valid_mask], y_obs[valid_mask]
print(f"訓練期間: {len(t_train)} 点（1920〜1990年）， 検証期間: {len(t_valid)} 点（1995〜2020年）")

result_train = least_squares(residuals, [0.03, 13000.0], args=(t_train, y_train, N0), bounds=(lower_bounds, upper_bounds))
r_train, K_train = result_train.x
print(f"訓練期間で推定: r = {r_train:.5f} /年,  K = {K_train:.1f} 万人")

# 推定したパラメタで全期間を計算する
y_fit_all = simulate_logistic(result_train.x, t_obs, N0)
rmse_train = np.sqrt(mean_squared_error(y_train, y_fit_all[train_mask]))
rmse_valid = np.sqrt(mean_squared_error(y_valid, y_fit_all[valid_mask]))
print(f"訓練期間の RMSE: {rmse_train:8.1f} 万人")
print(f"検証期間の RMSE: {rmse_valid:8.1f} 万人")
print(f"2020年の予測: {y_fit_all[-1]:.1f} 万人，観測: {y_obs[-1]:.1f} 万人")
```

1990年までのデータで推定すると，$K$ は約25,900万人と，全データで推定した約14,750万人の2倍近くになる．
1990年の時点では人口の頭打ちがまだ見えておらず，平衡人口 $K$ を十分に制約する情報が乏しかった．
訓練期間の RMSE は約140万人と小さいが，検証期間の RMSE は約2,150万人に跳ね上がる．
当てはまりの良さと予測の良さは別のものである．

### 指数成長モデルとの比較

第4回で比べた指数成長モデル $N' = rN$ も，同じ訓練期間で推定して検証期間の誤差を比べる．

```python
def residuals_exponential(theta, t_obs, y_obs, N0):
    """指数成長モデル N0 exp(r t) の残差ベクトルを返す．"""
    return N0 * np.exp(theta[0] * t_obs) - y_obs


result_exp = least_squares(residuals_exponential, [0.01], args=(t_train, y_train, N0))
y_exp_all = N0 * np.exp(result_exp.x[0] * t_obs)
print(f"指数成長モデル: r = {result_exp.x[0]:.5f} /年")
print(f"  訓練期間の RMSE: {np.sqrt(mean_squared_error(y_train, y_exp_all[train_mask])):8.1f} 万人")
print(f"  検証期間の RMSE: {np.sqrt(mean_squared_error(y_valid, y_exp_all[valid_mask])):8.1f} 万人")
```

### データ，推定モデル，残差を1枚に描く

推定結果を報告するときは，推定値の数字だけでなく，データと推定モデルを重ねた図と，残差の時系列を示す．
残差に時間的な偏りがあれば，モデルの構造，パラメタの設定，観測過程のいずれに原因があるかを検討する．

```python
years = population["year"].values
residual_all = y_fit_all - y_obs

fig, axes = plt.subplots(3, 1, figsize=(8, 9), sharex=True)

axes[0].plot(years, y_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
axes[0].plot(years, y_fit_all, color="tab:blue", label=f"logistic, fitted on <=1990 (r={r_train:.4f}, K={K_train:.0f})")
axes[0].plot(years, y_exp_all, color="tab:orange", linestyle="--", label=f"exponential, fitted on <=1990 (r={result_exp.x[0]:.4f})")
axes[0].axvspan(1995, 2020, color="gray", alpha=0.15, label="validation period")
axes[0].set_ylabel("Population [10^4 persons]")
axes[0].set_ylim(4000, 18000)
axes[0].set_title("Parameter estimation with a training / validation split")
axes[0].legend(fontsize=8)

axes[1].plot(years, residual_all, color="tab:blue", marker="o", markersize=3)
axes[1].axhline(0, color="black", linewidth=0.8)
axes[1].axvspan(1995, 2020, color="gray", alpha=0.15)
axes[1].set_ylabel("Residual, logistic\n[10^4 persons]")

axes[2].plot(years, y_exp_all - y_obs, color="tab:orange", marker="o", markersize=3)
axes[2].axhline(0, color="black", linewidth=0.8)
axes[2].axvspan(1995, 2020, color="gray", alpha=0.15)
axes[2].set_ylabel("Residual, exponential\n[10^4 persons]")
axes[2].set_xlabel("Year")

for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "logistic_fit_train_valid.png", dpi=150)
plt.show()
```

````{note} 演習2：訓練期間の長さを変える

1. 訓練期間の終わりを`1970`，`1990`，`2010`の3通りに変え，それぞれ推定値 $r$，$K$，訓練期間と検証期間の RMSE を表にする．検証期間は訓練期間の終わりの5年後から2020年までとする．
2. 訓練期間を長くすると $K$ の推定値はどう変わるか．データのどの部分が $K$ を決めているか．
3. 訓練期間の RMSE が最も小さい設定と，検証期間の RMSE が最も小さい設定は同じか．
````

````{note} 演習3：残差の形を読む

「データ，推定モデル，残差を1枚に描く」の図の残差を見て，次を`README.md`に書く．

1. Logisticモデルの残差は，訓練期間の中でも時期によって符号が偏っている．どの時期に正で，どの時期に負か．
2. 1940年代の残差が大きいのはなぜか．モデルに含まれていない現実の要因を挙げる．
3. 残差が完全にランダムに見えるとき，見えないとき，それぞれモデルについて何が言えるか．
````

```{tip} 推定と検証は別の作業である
パラメタ推定では，モデルと目的関数を固定し，訓練データに対する目的関数を小さくするパラメタを求める．
検証では，推定に使用しなかったデータに対する予測誤差や残差の傾向を評価する．
前者がうまくいっても後者がうまくいくとは限らない．
第12回では，この区別を土台にして，複数のモデルを比較する方法を扱う．
```

## オープンデータへの応用：ダムの貯水位と貯水量の換算

### 貯水位・貯水量の換算係数を推定する

第6回では，貯水位 $h$ から貯水量 $V$ への換算を傾き約627千m³/mの線形関係とした．
これはダムの諸元から仮定した値で，計算結果は観測から最終的に約5,000千m³ずれた．
この傾きを未知のパラメタ $\alpha$ とし，データから推定する．

$$
V(t) = \alpha\,(h(t) - h_{\min}),
\qquad
\frac{dV}{dt} = Q_{\mathrm{in}}(t) - Q_{\mathrm{out}}(t)
$$

$V$ は直接観測されないので，残差は観測量である貯水位で定義する．
モデルの貯水量を $\alpha$ で割って貯水位に戻し，観測された貯水位との差を残差とする．

$$
\hat{h}(t_i;\alpha) = h_{\min} + \frac{V(t_i)}{\alpha},
\qquad
e_i(\alpha) = \hat{h}(t_i;\alpha) - h_i
$$

これは，状態変数と観測量が一致しないときに，**観測モデル**を通して残差を定義する例である．

```python
dam = pd.read_csv(DATA_DIR / "dam_urayama_daily.csv", parse_dates=["date"])
dam_year = dam[dam["date"].dt.year == 2019].reset_index(drop=True)

SECONDS_PER_DAY = 24 * 60 * 60
LEVEL_MIN = 304.0


def m3s_to_1000m3_per_day(flow_m3s):
    """流量 [m^3/s] を [千m^3/日] に換算する．"""
    return flow_m3s * SECONDS_PER_DAY / 1000


t_dam = np.arange(len(dam_year), dtype=float)
qin_dam = m3s_to_1000m3_per_day(dam_year["inflow_m3s"].values)
qout_dam = m3s_to_1000m3_per_day(dam_year["outflow_m3s"].values)
h_dam = dam_year["water_level_m"].values


def reservoir_rhs(t, V, t_data, qin_data, qout_data):
    """dV/dt = Q_in(t) - Q_out(t) の右辺．入力は観測値の線形補間．"""
    return np.interp(t, t_data, qin_data) - np.interp(t, t_data, qout_data)


def simulate_level(alpha, t_data, qin_data, qout_data, h_data):
    """傾き alpha で貯水量を計算し，貯水位に戻して返す．初期条件は初日の観測貯水位から決める．"""
    V0 = alpha * (h_data[0] - LEVEL_MIN)
    sol = solve_ivp(reservoir_rhs, (t_data[0], t_data[-1]), [V0], t_eval=t_data, args=(t_data, qin_data, qout_data), max_step=1.0)
    return LEVEL_MIN + sol.y[0] / alpha


def residuals_level(theta, t_data, qin_data, qout_data, h_data):
    """傾き theta[0] における貯水位の残差（モデル - 観測）を返す．"""
    return simulate_level(theta[0], t_data, qin_data, qout_data, h_data) - h_data


alpha_assumed = 56000.0 / (393.3 - 304.0)
rmse_assumed = np.sqrt(np.mean(residuals_level([alpha_assumed], t_dam, qin_dam, qout_dam, h_dam) ** 2))
print(f"第6回の仮定 alpha = {alpha_assumed:.1f} 千m^3/m のとき，貯水位の RMSE = {rmse_assumed:.2f} m")

result_alpha = least_squares(residuals_level, [alpha_assumed], args=(t_dam, qin_dam, qout_dam, h_dam), bounds=([100.0], [5000.0]))
alpha_hat = result_alpha.x[0]
rmse_alpha = np.sqrt(np.mean(result_alpha.fun ** 2))
print(f"推定した alpha = {alpha_hat:.1f} 千m^3/m のとき，貯水位の RMSE = {rmse_alpha:.2f} m（評価回数 {result_alpha.nfev}）")
print(f"推定された湖面の面積に相当する値: {alpha_hat / 1000:.2f} km^2")
```

```python
h_assumed = simulate_level(alpha_assumed, t_dam, qin_dam, qout_dam, h_dam)
h_fitted = simulate_level(alpha_hat, t_dam, qin_dam, qout_dam, h_dam)

fig, axes = plt.subplots(2, 1, figsize=(8, 6), sharex=True)
axes[0].plot(dam_year["date"], h_dam, color="black", label="observed water level")
axes[0].plot(dam_year["date"], h_assumed, color="tab:green", linestyle="--", label=f"model, assumed alpha = {alpha_assumed:.0f}")
axes[0].plot(dam_year["date"], h_fitted, color="tab:blue", label=f"model, estimated alpha = {alpha_hat:.0f}")
axes[0].set_ylabel("Water level [m]")
axes[0].set_title("Urayama Dam 2019: estimating the level-volume slope")
axes[0].legend()
axes[1].plot(dam_year["date"], h_assumed - h_dam, color="tab:green", linestyle="--", label="residual, assumed alpha")
axes[1].plot(dam_year["date"], h_fitted - h_dam, color="tab:blue", label="residual, estimated alpha")
axes[1].axhline(0, color="black", linewidth=0.8)
axes[1].set_ylabel("Model - observed [m]")
axes[1].set_xlabel("Date")
axes[1].legend()
for ax in axes:
    ax.grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "dam_alpha_estimation.png", dpi=150)
plt.show()
```

推定された傾きは約1,030千m³/mで，諸元から仮定した627千m³/mより6割以上大きい．
面積に直せば約1.0 km²の湖面に相当し，採用した線形観測モデルでの有効な換算係数として解釈できる．実際の湖面積を独立に測定した値ではない．
貯水位の RMSE は約4.6 mから約0.5 mに下がる．

しかし，この $\alpha$ は2019年のデータに対する目的関数を最小化する一定の傾きであって，水位・容量曲線そのものではない．
別の年，特に水位が大きく下がった年では，別の値が推定されるはずである．
1つの数で表せない関係を1つのパラメタで表している，という限界を意識する．

````{note} 演習4：推定の安定性を確かめる

1. 対象の年を`2020`から`2023`に変えて $\alpha$ を推定し，年ごとの推定値と RMSE を`README.md`の「演習4」に表にする．
2. 推定値は年によってどのくらい変わるか．水位の範囲が大きく違う年はあるか．
3. 第6回の発展演習で加えた一定の損失項 $c$ を第2のパラメタとして加え，$(\alpha, c)$ を同時に推定する．RMSE はさらに下がるか．$c$ の符号と大きさは物理的に妥当か．
````

```{dropdown} 演習4の確認：2パラメタの推定
残差関数を`theta = (alpha, c)`を受け取る形にし，右辺から`c`を引けばよい．
2019年では $\alpha \approx 1045$，$c \approx 2.1$ 千m³/日（約0.024 m³/s）が得られ，RMSE は約0.23 mまで下がる．
$c$ が正で，蒸発や漏水として無理のない大きさである．
ただし，元のモデルを $c=0$ として含む拡張では，同じデータに対する目的関数を厳密に最小化できれば，最小値は増加しない．
増えたパラメタに物理的な意味が付けられるか，別の年でも同じ値になるかを確かめない限り，改善とは言えない．
```

## モデルの限界と改善の問い

- 最小二乗法は残差の二乗和を最小にするだけであり，モデルの構造が正しいことは保証しない．どのモデルの中でパラメタを探すかは，推定の前に人が決める
- 数値最適化は初期値によって別の解に着くことがある．複数の初期値，パラメタの範囲，粗い格子探索を組み合わせて，見つけた解が本当に最小かを確かめる
- 訓練期間の当てはまりが良くても，検証期間の予測が悪いことがある．データが含んでいない情報（人口の頭打ち）は，どんな推定法でも取り出せない
- パラメタを増やすと当てはまりは良くなるが，推定値の意味と安定性が下がることがある．第8回でこの問題をタンクモデルで扱う
- 推定値には不確かさがある．残差の大きさだけではパラメタ推定値の不確かさを表せない．推定期間を変えたときの安定性を確認し，信頼区間などの定量的評価は発展事項とする

## まとめ

- 残差 $e_i(\theta) = \hat{y}(t_i;\theta) - y_i$ の二乗和を目的関数とし，それを最小にするパラメタを選ぶのが最小二乗法である
- 格子探索は指定した格子点をすべて評価する．数値最適化は局所的な情報からパラメタを反復更新する．後者は評価回数を減らせる場合があるが，初期値によって異なる結果となり得る
- `least_squares(残差関数, 初期値, args=(...), bounds=(...))`で推定でき，結果は`result.x`，残差は`result.fun`，評価回数は`result.nfev`で確認する
- データを訓練期間と検証期間に分けることで，当てはまりの良さと予測の良さを区別できる
- 状態変数が直接観測されないときは，観測モデルを通して残差を定義する．ダムの貯水位と貯水量の換算の傾きは，その例である
- 推定結果は数字だけでなく，データと推定モデルと残差の図で報告する

## 課題

````{warning} 課題1：推定結果の報告

人口のLogisticモデルについて，訓練期間の終わりを自分で1つ選び（1960年から2010年の間），次を含む短い報告を`README.md`の「課題1」に書く．

1. 推定条件：モデル，推定するパラメタ，目的関数，訓練期間，検証期間，初期値，パラメタの範囲
2. 推定値 $r$，$K$ と，訓練期間・検証期間それぞれの RMSE
3. 複数の初期値から同じ推定値に到達したことの確認
4. データ，推定モデル，残差を1枚に描いた図（`reports/figures/`に保存）
5. 残差の時系列から読み取れる，モデルに足りない要因を1つ

適合度として訓練期間のRMSEを，推定の安定性として訓練期間を5年ずらしたときの推定値の変化幅を書く．これらはパラメタの信頼区間とは区別する．
````

````{warning} 課題2：推定と検証の区別

次の主張について，賛成か反対かを明らかにし，今回の人口データの結果を根拠にして200字程度で論じる．

「1920年から2020年の全データを使って推定したLogisticモデルの RMSE は約340万人と小さい．したがってこのモデルは2050年の人口予測に使える．」

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

## 次回への接続

今回，ダムの放流量は観測データとしてモデルに与えた．
しかし，自然の湖や，操作されていない河川では，流出量は貯まっている水の量で決まる．
第8回では，放流量を $Q_{\mathrm{out}} = kV$ のように貯水量の関数としてモデル化した場合と，観測データとして与えた場合を比べる．
さらに，降水量を入力として河川への流出を表すタンクモデル $S' = P(t) - kS$，$Q = kS$ を作り，今回の方法でパラメタ $k$ を推定する．
パラメタを増やすと当てはまりは良くなるが説明可能性と推定の安定性が下がる，という問題を具体的に確かめる．

## 自分の言葉で説明する問い

1. 残差，目的関数，最小二乗法の3つの言葉の関係を説明せよ．
2. 第5回のパラメタサーチと今回の数値最適化は，何が同じで何が違うか．それぞれの長所と短所を述べよ．
3. 最適化の停止条件を満たしても，大域的最小値を得たとは限らない．なぜか．どうすれば確かめられるか．
4. 訓練期間の RMSE が小さいのに検証期間の RMSE が大きい，という結果はモデルについて何を教えているか．人口データの例で説明せよ．
