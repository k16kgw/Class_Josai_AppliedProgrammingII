# 第12回　モデルの検証と発展

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
\text{パラメタ推定}
\rightarrow
\underline{\text{モデルの検証と改善}}
$$

ワークフローの最後の段階である．
ここまでの回で，モデルを作り，計算し，データと比べ，パラメタを推定してきた．
今回は「そのモデルはどこまで信用できるか」「次にどの仮定を見直すべきか」を判断する方法を整理する．

判断の材料は，当てはまりの良さだけではない．
残差の時系列，推定に使わなかったデータでの誤差，複数のモデルの比較，そして誤差がどこから来ているかの区別が必要になる．
後半では，第11回のSIRモデルに何を加えるべきかを，各自で状態遷移図と式にする．

## 今回の到達目標

- モデルと観測値の差を，構造による誤差，パラメタ推定による誤差，観測誤差，数値誤差の4種類に区別して説明できる
- 残差の時系列を描き，偏りの有無からモデルの構造的な不足を読み取れる
- データを訓練期間と検証期間に分けてパラメタを推定し，検証誤差でモデルを比較できる
- 複雑なモデルほど訓練誤差は下がるが検証誤差は上がり得ること（過学習）を，具体例で説明できる
- SIRモデルに不足する要因を1つ選び，状態遷移図と式として拡張案を作り，複雑化の利点と不利益を比較できる

**今回の流れ**（105分の目安）

| 段階 | 内容 | 時間 |
| --- | --- | --- |
| 1 | 第11回の復習，「当てはまりが良い」だけでは足りない例（演習0） | 10分 |
| 2 | 誤差の4分類，残差の読み方，訓練と検証の考え方 | 25分 |
| 3 | 人口データとSIRモデルでの検証の実演，過学習の例 | 20分 |
| 4 | 分割点を変える演習，モデル比較表，SIRの拡張案の作成（演習1〜3） | 35分 |
| 5 | 拡張案の共有，複雑化の利点と不利益，まとめ，課題の説明 | 15分 |

## 前回の復習と今回の位置付け

第11回では，第7波の新規陽性者数にSIRモデルを当てた．
2つの当てはめはRMSEがほぼ同じだったのに，一方は「平均感染期間1日未満，$R_0 = 1.05$」，他方は「平均感染期間7日，$R_0 = 1.5$」という，まったく違うパラメタになった．
また，残差には8月後半から9月に観測がモデルを上回る偏りがあった．

この経験は2つのことを示している．

- 当てはまりの数値が同じでも，モデルの意味は同じではない．評価には当てはまり以外の情報が必要である
- 残差の偏りは，パラメタをいくら調整しても消えない食い違い，つまりモデルの構造の問題を示している

今回は，この2点を一般的な手順として整理する．
題材には，第3回から使ってきた人口データと，第11回のSIRモデルの両方を使う．

## 準備

````{note} 演習0：作業フォルダとNotebookを作成する

1. ターミナルで第12回の作業フォルダを作成する．

```bash
mkdir -p ~/applied_programming_ii/12
cd ~/applied_programming_ii/12
mkdir -p notebooks reports/figures
```

2. `~/applied_programming_ii/data/`に`population_japan.csv`と`covid19_new_cases_daily.csv`があることを確認する．

3. `notebooks/validation.ipynb`を新規作成する．

4. `12`フォルダに`README.md`を作り，次の内容を記入する．

```markdown
# 応用プログラミングII 第12回

- 氏名：
- 学籍番号：

## 今日の目標

残差，検証期間の誤差，モデル比較によってモデルの妥当性と限界を評価し，SIRモデルの拡張案を作る．

## 演習1：分割点と検証誤差

| 訓練期間の終わり | 指数モデルの検証RMSE | Logisticモデルの検証RMSE |
| --- | --- | --- |

## 演習2：残差の読み取り

## 演習3：SIRモデルの拡張案

- 選んだ要因：
- 追加した状態変数・パラメタ：
- 状態遷移図：
- 式：
- 利点と不利益：

## 課題1

## 課題2の考察
```

5. Notebookの最初のコードセルに以下を入力し，実行できることを確認する．

```python
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

PROJECT_DIR = Path.home() / "applied_programming_ii" / "12"
DATA_DIR = Path.home() / "applied_programming_ii" / "data"
FIGURE_DIR = PROJECT_DIR / "reports" / "figures"
FIGURE_DIR.mkdir(parents=True, exist_ok=True)

print("作業フォルダ:", PROJECT_DIR)
print("人口データの有無:", (DATA_DIR / "population_japan.csv").exists())
print("感染者数データの有無:", (DATA_DIR / "covid19_new_cases_daily.csv").exists())
```
````

## 導入：「当てはまりが良い」だけでは足りない

第4回と第7回で使ったLogisticモデルを，全期間の人口データに当てはめる．
今回使う関数をここでまとめて定義する．

```python
population = pd.read_csv(DATA_DIR / "population_japan.csv")
population["population_10k"] = population["total_population_thousand"] / 10

years = population["year"].to_numpy()
N_obs = population["population_10k"].to_numpy()       # 観測値 [万人]
t_years = (years - 1920).astype(float)                # 1920年を t = 0 とする [年]
N0 = N_obs[0]                                         # 初期条件：1920年の人口 [万人]


def exponential_rhs(t, N, r):
    """指数成長モデル dN/dt = r N の右辺．"""
    return r * N


def logistic_rhs(t, N, r, K):
    """Logisticモデル dN/dt = r N (1 - N/K) の右辺．"""
    return r * N * (1 - N / K)


def simulate_population(rhs, params, t_eval):
    """1920年の人口を初期条件として，与えた右辺とパラメタで人口を計算する．"""
    sol = solve_ivp(rhs, (0.0, t_eval[-1]), [N0], t_eval=t_eval, args=tuple(params), rtol=1e-8)
    return sol.y[0]


def mean_squared_error(y_obs, y_model):
    """観測値とモデル出力の平均二乗誤差を返す．"""
    return np.mean((y_obs - y_model) ** 2)


def root_mean_squared_error(y_obs, y_model):
    """平均二乗誤差の平方根（観測値と同じ単位）を返す．"""
    return np.sqrt(mean_squared_error(y_obs, y_model))
```

```python
def residuals_logistic_all(params):
    return simulate_population(logistic_rhs, params, t_years) - N_obs


result_all = least_squares(residuals_logistic_all, x0=[0.02, 15000.0], bounds=([0.0, 5000.0], [1.0, 50000.0]))
r_all, K_all = result_all.x
N_logistic_all = simulate_population(logistic_rhs, (r_all, K_all), t_years)

print(f"全期間で推定: r = {r_all:.4f} /年,  K = {K_all:.0f} 万人")
print(f"RMSE = {root_mean_squared_error(N_obs, N_logistic_all):.1f} 万人")
```

RMSEは約340万人で，1億2000万人の人口に対して3%程度である．
数値だけ見れば「よく合っている」と言いたくなる．
しかし，この推定値 $K \approx 14750$ 万人は，人口が今後1億4750万人に向かって増え続けることを意味する．
実際には人口はすでに減っている．
当てはまりの良さは，モデルが現象を正しく捉えていることを保証しない．

## 誤差の4つの種類

モデルの出力と観測値が食い違う原因を，4つに分けて考える．

| 種類 | 原因 | 例 | 減らす手段 |
| --- | --- | --- | --- |
| 構造による誤差 | モデルの仮定が現象と食い違う | 指数成長モデルで人口の頭打ちを表せない（第3回），SIRで潜伏期間を無視（第11回） | 仮定を見直し，モデルの形を変える |
| パラメタ推定による誤差 | パラメタの値が真の値からずれている | 2時点だけで決めた $r$（第1回），局所解に落ちた推定（第7回） | データを増やす，推定方法や初期値を工夫する |
| 観測誤差 | 観測量そのものに誤差や偏りがある | 曜日による報告数の変動（第11回），ダムの流入量が貯水位の変化から逆算された値であること（第6回） | 観測モデルを入れる，平滑化する，観測の仕組みを調べる |
| 数値誤差 | 微分方程式を近似的に解いていることによる誤差 | Euler法の刻み幅による誤差（第2回） | 刻み幅を小さくする，高精度な解法を使う，許容誤差を厳しくする |

この4つは性質が違う．
数値誤差は計算を丁寧にすれば減る．
パラメタ推定の誤差はデータと推定方法の工夫で減る．
観測誤差はモデル側では減らせないが，観測モデルとして扱える．
構造による誤差は，どれだけ計算とデータを工夫しても消えない．
モデルの評価とは，主にこの構造による誤差を見つける作業である．

### 数値誤差を確かめる：第2回の再解釈

第2回では，刻み幅を変えると数値解が変わることを見た．
これを「数値誤差」として改めて確かめる．
先ほど推定したLogisticモデルをEuler法で解き，`solve_ivp`の結果と比べる．

```python
def euler(rhs, t_span, x0, h, args=()):
    """前進Euler法で初期値問題を解き，時刻と近似解の配列を返す．"""
    t0, t_end = t_span
    n_steps = int(round((t_end - t0) / h))
    t = t0 + h * np.arange(n_steps + 1)
    x = np.zeros(n_steps + 1)
    x[0] = x0
    for k in range(n_steps):
        x[k + 1] = x[k] + h * rhs(t[k], x[k], *args)
    return t, x


N_2020_ivp = simulate_population(logistic_rhs, (r_all, K_all), np.array([0.0, 100.0]))[-1]
print(f"solve_ivp（rtol=1e-8）の2020年: {N_2020_ivp:.1f} 万人")
print(f"{'刻み幅 h [年]':>12} {'Euler法の2020年':>16} {'solve_ivpとの差':>16}")
for h in [20.0, 10.0, 5.0, 1.0, 0.1]:
    t_e, N_e = euler(logistic_rhs, (0.0, 100.0), N0, h, args=(r_all, K_all))
    print(f"{h:12.1f} {N_e[-1]:16.1f} {N_e[-1] - N_2020_ivp:+16.2f}")
print(f"参考：2020年の観測値との差: {N_2020_ivp - N_obs[-1]:+.1f} 万人")
```

刻み幅20年では400万人近い数値誤差が出るが，刻み幅1年で20万人以下，`solve_ivp`ではさらに小さい．
一方，このモデルの2020年の値は観測値より750万人以上多い．
この差は数値誤差ではなく，モデルの構造から来ている．
以後，`solve_ivp`を許容誤差を指定して使う限り，数値誤差は無視できる大きさだと考える．

## 残差の時系列を読む

残差 $e_i = y_i - \hat{y}(t_i)$ を時間順に並べた図は，構造による誤差を見つける最も基本的な道具である．

```python
residual_all = N_obs - N_logistic_all

fig, axes = plt.subplots(2, 1, figsize=(8, 7), sharex=True)
axes[0].plot(years, N_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
axes[0].plot(years, N_logistic_all, label=f"logistic fitted to all years (r = {r_all:.4f}, K = {K_all:.0f})")
axes[0].set_title("Logistic model fitted to 1920-2020")
axes[0].set_ylabel("Population [10^4 persons]")
axes[0].grid(True)
axes[0].legend()

axes[1].plot(years, residual_all, marker="o", markersize=3)
axes[1].axhline(0, color="gray")
axes[1].set_title("Residuals: observed - model")
axes[1].set_xlabel("Year")
axes[1].set_ylabel("Residual [10^4 persons]")
axes[1].grid(True)
fig.tight_layout()
fig.savefig(FIGURE_DIR / "logistic_all_residuals.png", dpi=150)
plt.show()

print("残差が正の年の数:", int(np.sum(residual_all > 0)), " 負の年の数:", int(np.sum(residual_all < 0)))
print(f"1940〜1950年の残差の平均: {residual_all[(years >= 1940) & (years <= 1950)].mean():+.0f} 万人")
print(f"2010〜2020年の残差の平均: {residual_all[(years >= 2010) & (years <= 2020)].mean():+.0f} 万人")
```

残差がランダムに0の周りに散らばっていれば，モデルは系統的な傾向を捉えている．
ここでは，残差が長い期間にわたって同じ符号を持ち，波のような形をしている．
1940年代の落ち込みは戦争による一時的な変化，2010年代の負の残差はモデルが表せない減少局面である．
このような偏りは，パラメタを動かしても消えない．
残差の図に「形」が見えたら，構造による誤差を疑う．

```{tip} 残差を読むときの3つの問い
1. 残差は0の周りにランダムに散っているか，まとまった期間で同じ符号か
2. 残差の大きさは時間とともに大きくなっているか（外挿するほど外れる兆候）
3. 残差が大きい時期に，現実には何が起きていたか（戦争，政策，災害，対策の変化）
```

## 訓練期間と検証期間

### 考え方

第7回で導入したように，データの一部でパラメタを推定し（訓練期間），残りでモデルの予測を確かめる（検証期間）．
訓練期間の誤差は，モデルが「見たデータ」にどれだけ合わせられたかを示す．
検証期間の誤差は，モデルが「見ていないデータ」をどれだけ説明できるかを示す．
モデルの妥当性を判断するのは後者である．

### 人口データ：指数成長モデルとLogisticモデル

1990年までを訓練期間，1995年以降を検証期間とする．

```python
train = years <= 1990
valid = years >= 1995


def fit_population_model(rhs, x0, bounds, mask):
    """mask が True の年だけを使ってパラメタを推定し，推定値を返す．"""
    def residuals(params):
        return simulate_population(rhs, params, t_years)[mask] - N_obs[mask]
    return least_squares(residuals, x0=x0, bounds=bounds).x


params_exp = fit_population_model(exponential_rhs, x0=[0.01], bounds=([0.0], [1.0]), mask=train)
params_log = fit_population_model(logistic_rhs, x0=[0.02, 15000.0], bounds=([0.0, 5000.0], [1.0, 50000.0]), mask=train)

N_exp = simulate_population(exponential_rhs, params_exp, t_years)
N_log = simulate_population(logistic_rhs, params_log, t_years)

comparison = pd.DataFrame({
    "model": ["exponential", "logistic"],
    "parameters": [f"r = {params_exp[0]:.4f}", f"r = {params_log[0]:.4f}, K = {params_log[1]:.0f}"],
    "n_params": [1, 2],
    "train_RMSE": [root_mean_squared_error(N_obs[train], N_exp[train]), root_mean_squared_error(N_obs[train], N_log[train])],
    "valid_RMSE": [root_mean_squared_error(N_obs[valid], N_exp[valid]), root_mean_squared_error(N_obs[valid], N_log[valid])],
})
print(comparison.round(1).to_string(index=False))
```

```python
fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(years, N_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
ax.plot(years, N_exp, linestyle="--", label="exponential (trained on <= 1990)")
ax.plot(years, N_log, linestyle="-", label="logistic (trained on <= 1990)")
ax.axvspan(1995, 2020, color="gray", alpha=0.15, label="validation period")
ax.set_title("Population models: training <= 1990, validation 1995-2020")
ax.set_xlabel("Year")
ax.set_ylabel("Population [10^4 persons]")
ax.set_ylim(0, 20000)
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "population_train_valid.png", dpi=150)
plt.show()
```

Logisticモデルは訓練期間で約140万人，検証期間で約2150万人の誤差である．
指数成長モデルはそれぞれ約230万人，約3900万人である．
Logisticモデルのほうがどちらも小さいが，検証期間の誤差は訓練期間の15倍に膨らんでいる．
どちらのモデルも，1990年までのデータからは2000年代の頭打ちと減少を予測できていない．
「訓練期間より検証期間の誤差が大きく，時間とともに広がる」のは，外挿が危険であることの数値的な現れである．

````{note} 演習1：分割点を変える

`train = years <= 1990`の1990を`1970`，`1980`，`2000`，`2010`に変え，それぞれについて指数成長モデルとLogisticモデルの検証RMSEを`README.md`の表に記録する．検証期間はいつも「訓練期間の終わりの5年後から2020年まで」とする．

1. 訓練期間を長くすると，検証誤差は必ず小さくなるか．
2. 訓練期間を2010年までにしたとき，Logisticモデルの $K$ はいくらになるか．全期間で推定した $K \approx 14750$ 万人や，1990年までで推定した値と比べる．同じモデルでも訓練期間によって $K$ が大きく変わることは，何を意味するか．
3. 検証期間が短いと，検証誤差の値はどれだけ信用できるか．
````

## 過学習：複雑にすれば合うが予測できない

パラメタを増やせば訓練期間の当てはまりは必ず良くなる．
しかし検証期間の誤差は，ある程度を超えると悪化する．
これを**過学習**と呼ぶ．
微分方程式モデルでは起きにくい形で見せるため，ここでは多項式を当ててみる．

```python
t_scaled = (years - 1970) / 50.0     # 数値的に安定させるため年を -1〜1 程度に変換する

print(f"{'次数':>4} {'パラメタ数':>8} {'訓練RMSE':>12} {'検証RMSE':>14}")
rows = []
for degree in [1, 2, 3, 4, 6, 8, 10]:
    coeffs = np.polyfit(t_scaled[train], N_obs[train], degree)
    N_poly = np.polyval(coeffs, t_scaled)
    train_rmse = root_mean_squared_error(N_obs[train], N_poly[train])
    valid_rmse = root_mean_squared_error(N_obs[valid], N_poly[valid])
    rows.append((degree, train_rmse, valid_rmse))
    print(f"{degree:4d} {degree + 1:8d} {train_rmse:12.1f} {valid_rmse:14.1f}")
```

```python
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))

for degree, linestyle in zip([1, 3, 8], ["--", "-", ":"]):
    coeffs = np.polyfit(t_scaled[train], N_obs[train], degree)
    axes[0].plot(years, np.polyval(coeffs, t_scaled), linestyle=linestyle, label=f"polynomial, degree {degree}")
axes[0].plot(years, N_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed")
axes[0].axvspan(1995, 2020, color="gray", alpha=0.15)
axes[0].set_title("Polynomials trained on <= 1990")
axes[0].set_xlabel("Year")
axes[0].set_ylabel("Population [10^4 persons]")
axes[0].set_ylim(0, 20000)
axes[0].grid(True)
axes[0].legend()

degrees = [row[0] for row in rows]
axes[1].plot(degrees, [row[1] for row in rows], marker="o", label="training RMSE")
axes[1].plot(degrees, [row[2] for row in rows], marker="s", label="validation RMSE")
axes[1].set_yscale("log")
axes[1].set_title("Training vs. validation error")
axes[1].set_xlabel("Polynomial degree (number of parameters - 1)")
axes[1].set_ylabel("RMSE [10^4 persons], log scale")
axes[1].grid(True)
axes[1].legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "overfitting_polynomial.png", dpi=150)
plt.show()
```

次数を上げるほど訓練誤差は単調に下がるが，検証誤差は3次で最小となり，6次以上では桁違いに悪化する．
8次の多項式は1990年までの71点をほぼ完璧に通るが，検証期間では観測値の数十倍の値を出す．
訓練期間だけを見てモデルを選ぶと，最も複雑なモデルが常に選ばれてしまう．
検証期間を残しておく理由はここにある．

```{tip} 微分方程式モデルでも過学習は起きる
多項式ほど極端ではないが，第8回で見たように，タンクを増やしパラメタを増やせば当てはまりは改善する．
その改善が検証期間でも保たれるかどうかを，必ず確かめる．
また，パラメタが増えると推定値が初期値に依存しやすくなり（第7回），意味のある値が得られにくくなる．
```

## SIRモデルの検証

第11回の第7波の当てはめを，訓練と検証に分けて行う．
流行の途中までのデータからピークを予測できるか，という問いである．

```python
cases = pd.read_csv(DATA_DIR / "covid19_new_cases_daily.csv", parse_dates=["date"])
cases["japan_7d"] = cases["new_cases_japan"].rolling(7, center=True).mean()

wave = cases[(cases["date"] >= "2022-07-01") & (cases["date"] <= "2022-09-30")].reset_index(drop=True)
y_obs = wave["japan_7d"].to_numpy()
t_obs = np.arange(len(y_obs), dtype=float)

N_japan = 1.25e8
gamma_fixed = 1.0 / 7.0


def sir_rhs(t, state, beta, gamma, N):
    """SIRモデルの右辺．"""
    S, I, R = state
    new_infections = beta * S * I / N
    return [-new_infections, new_infections - gamma * I, gamma * I]


def simulate_new_infections(beta, gamma, N, I0, t_eval):
    """各日の新規感染者数 beta S I / N を返す．"""
    sol = solve_ivp(sir_rhs, (t_eval[0], t_eval[-1]), [N - I0, I0, 0.0], t_eval=t_eval, args=(beta, gamma, N), rtol=1e-6)
    S, I, R = sol.y
    return beta * S * I / N


def fit_sir_on(n_train):
    """最初の n_train 日だけを使って beta, N_eff, I0 を推定する．"""
    def residuals(params):
        beta_p, N_eff_p, I0_p = params
        return simulate_new_infections(beta_p, gamma_fixed, N_eff_p, I0_p, t_obs[:n_train]) - y_obs[:n_train]
    result = least_squares(residuals, x0=[0.3, 1e7, 2e5], bounds=([0.01, 1e5, 1.0], [3.0, N_japan, 1e7]), x_scale=[0.1, 1e6, 1e5])
    return result.x
```

```python
print(f"{'訓練割合':>8} {'訓練日数':>8} {'beta':>8} {'R0':>6} {'N_eff':>10} {'モデルのピーク日':>14} {'訓練RMSE':>10} {'検証RMSE':>10}")
sir_rows = []
for frac in [0.4, 0.5, 0.6, 0.7]:
    n_train = int(frac * len(y_obs))
    beta_f, N_eff_f, I0_f = fit_sir_on(n_train)
    y_fit = simulate_new_infections(beta_f, gamma_fixed, N_eff_f, I0_f, t_obs)
    train_rmse = root_mean_squared_error(y_obs[:n_train], y_fit[:n_train])
    valid_rmse = root_mean_squared_error(y_obs[n_train:], y_fit[n_train:])
    sir_rows.append((frac, n_train, y_fit))
    print(f"{frac:8.1f} {n_train:8d} {beta_f:8.4f} {beta_f / gamma_fixed:6.2f} {N_eff_f:10.2e} {int(t_obs[y_fit.argmax()]):14d} {train_rmse:10.0f} {valid_rmse:10.0f}")
print(f"観測のピーク: {int(t_obs[y_obs.argmax()])} 日目")
```

```python
fig, ax = plt.subplots(figsize=(9, 5))
ax.plot(wave["date"], y_obs, color="black", marker="o", markersize=3, linestyle="none", label="observed (7-day mean)")
for (frac, n_train, y_fit), linestyle in zip(sir_rows, ["--", "-", "-.", ":"]):
    ax.plot(wave["date"], y_fit, linestyle=linestyle, label=f"SIR trained on first {int(100 * frac)}% ({n_train} days)")
ax.set_title("7th wave: predicting the peak from the early part of the wave")
ax.set_xlabel("Date")
ax.set_ylabel("New cases [persons/day]")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "sir_train_valid.png", dpi=150)
plt.show()
```

最初の40〜50%（ピーク前）だけで推定すると，ピークの高さはおおむね予測できるが時期が早すぎ，検証誤差は訓練誤差の10倍前後になる．
60%以上（ピークを含む）を使うと，検証期間である減少局面の誤差は小さくなる．
流行の途中でピークを予測することは，SIRモデルが表せない要因（行動変容，報告の遅れ）の影響を強く受ける．
第11回で見た「モデルのピークが観測より早い」という残差の偏りが，予測の誤差として現れている．

### 複数モデルの比較表

第11回の2つの当てはめ（総人口 $N$ で $\beta$，$\gamma$ を推定したもの，$\gamma$ を固定して $N_{\mathrm{eff}}$ を推定したもの）と，報告率 $\rho$ を入れたものを，同じ表に並べる．

```python
def fit_and_evaluate(residual_func, x0, bounds, x_scale, predict_func):
    """least_squares で推定し，推定値と全期間のRMSEを返す．"""
    result = least_squares(residual_func, x0=x0, bounds=bounds, x_scale=x_scale)
    y_fit = predict_func(result.x)
    return result.x, root_mean_squared_error(y_obs, y_fit)


# モデルA：N = 総人口，beta と gamma を推定
pred_a = lambda p: simulate_new_infections(p[0], p[1], N_japan, p[2], t_obs)
params_a, rmse_a = fit_and_evaluate(lambda p: pred_a(p) - y_obs, [0.5, 0.2, 1e5], ([0.01, 0.01, 1.0], [5.0, 2.0, 1e7]), [0.1, 0.1, 1e5], pred_a)

# モデルB：gamma = 1/7 固定，beta，N_eff，I0 を推定
pred_b = lambda p: simulate_new_infections(p[0], gamma_fixed, p[1], p[2], t_obs)
params_b, rmse_b = fit_and_evaluate(lambda p: pred_b(p) - y_obs, [0.3, 1e7, 2e5], ([0.01, 1e5, 1.0], [3.0, N_japan, 1e7]), [0.1, 1e6, 1e5], pred_b)

# モデルC：gamma = 1/7 固定，N = 総人口，beta，I0，報告率 rho を推定
pred_c = lambda p: p[2] * simulate_new_infections(p[0], gamma_fixed, N_japan, p[1], t_obs)
params_c, rmse_c = fit_and_evaluate(lambda p: pred_c(p) - y_obs, [0.3, 1e6, 0.3], ([0.01, 1.0, 0.01], [3.0, 5e7, 1.0]), [0.1, 1e5, 0.1], pred_c)

sir_comparison = pd.DataFrame({
    "model": ["A: SIR, N = total, beta & gamma free", "B: SIR, gamma = 1/7, N_eff estimated", "C: SIR + reporting rate rho"],
    "n_params": [3, 3, 3],
    "beta": [params_a[0], params_b[0], params_c[0]],
    "gamma": [params_a[1], gamma_fixed, gamma_fixed],
    "R0": [params_a[0] / params_a[1], params_b[0] / gamma_fixed, params_c[0] / gamma_fixed],
    "extra": [f"I0 = {params_a[2]:.0f}", f"N_eff = {params_b[1]:.2e}", f"rho = {params_c[2]:.3f}"],
    "RMSE": [rmse_a, rmse_b, rmse_c],
})
print(sir_comparison.round(3).to_string(index=False))
```

3つのモデルのRMSEはほぼ同じである．
しかしモデルAの $R_0 \approx 1.05$ と平均感染期間0.8日は現実離れしており，モデルBとCは同じ $\beta$，同じ $R_0 \approx 1.5$ を与える．
BとCが同じ曲線を出すのは，「集団の17%だけが関与した」と「全員が関与したが17%だけが報告された」が，曲線の形からは区別できないためである．
当てはまりの表だけでは，どのモデルが正しいかは決まらない．
外部の知識（平均感染期間），パラメタの意味，残差の偏りを合わせて判断する．

````{note} 演習2：残差の偏りを読む

1. モデルBの残差 `y_obs - pred_b(params_b)` を時系列で描き，符号が同じ期間がどこに固まっているかを書き出す．
2. その期間に現実に何が起きていたかを調べ（お盆の帰省，学校の夏休みの終わり，検査体制の変更など），残差の偏りと対応づけられる要因を1つ挙げる．
3. その要因は，誤差の4分類のどれに属するか．構造による誤差なら，モデルのどの仮定を変えれば表せるか．
````

## モデルの発展：SIRに足りないもの

第11回の限界の議論と，今回の残差の読み取りから，SIRモデルに足りない要因を整理する．

| 要因 | 現実の現象 | モデルへの入れ方の例 |
| --- | --- | --- |
| 潜伏期間 | 感染してから感染力を持つまでに数日かかる | 区画 $E$（潜伏）を追加し，$S \to E \to I \to R$ とする |
| ワクチン | 感受性者が感染を経ずに免疫を得る | $S \to R$ の流れ $vS$ を追加する |
| 出生と死亡 | 長期では人口が入れ替わる | $S$ への流入 $\mu N$ と各区画からの流出 $\mu S, \mu I, \mu R$ を追加する |
| 年齢構成 | 年齢によって接触頻度や重症化率が違う | 区画を年齢層ごとに分け，接触行列で結ぶ |
| 行動変容 | 流行が広がると人々が接触を減らす | $\beta$ を定数ではなく $I$ や時間の関数 $\beta(t)$ にする |
| 季節性 | 気温や湿度，学校の休みで接触や感染しやすさが変わる | 第9回のように $\beta(t) = \beta_0(1 + a\sin(2\pi t / 365 + \phi))$ とする |
| 地域間移動 | 地域ごとに流行の時期が違い，人の移動で伝わる | 地域ごとにSIRを置き，移動項で結ぶ |
| 免疫の減衰 | 回復者が再び感染する | $R \to S$ の流れ $\omega R$ を追加する |

### 例：潜伏期間を加えたSEIRモデル

感染してから平均 $1/\sigma$ 日後に感染力を持つとし，その間の人を潜伏者 $E$ とする．

```{mermaid}
flowchart LR
    S["S: 感受性者"] -->|"感染  βSI/N"| E["E: 潜伏者"]
    E -->|"発症  σE"| I["I: 感染者"]
    I -->|"回復  γI"| R["R: 回復者"]
```

$$
\begin{aligned}
\frac{dS}{dt} &= -\beta\,\frac{S\,I}{N} \\
\frac{dE}{dt} &= \beta\,\frac{S\,I}{N} - \sigma\,E \\
\frac{dI}{dt} &= \sigma\,E - \gamma\,I \\
\frac{dR}{dt} &= \gamma\,I
\end{aligned}
$$

追加されたのは状態変数 $E$ とパラメタ $\sigma$ の2つである．
4本の式の和は0で，$S + E + I + R = N$ が保たれる．
感染の流れは $S$ から $E$ に入り，$I$ には $\sigma E$ として遅れて入る点が，SIRとの違いである．

```python
def seir_rhs(t, state, beta, sigma, gamma, N):
    """SEIRモデルの右辺．state = [S, E, I, R]．"""
    S, E, I, R = state
    new_infections = beta * S * I / N
    return [-new_infections, new_infections - sigma * E, sigma * E - gamma * I, gamma * I]


N_demo = 100000.0
beta_demo, gamma_demo = 0.3, 0.1
sigma_demo = 1.0 / 3.0          # 平均潜伏期間 3日
I0_demo = 10.0
t_eval_demo = np.arange(0.0, 251.0)

sol_sir = solve_ivp(sir_rhs, (0.0, 250.0), [N_demo - I0_demo, I0_demo, 0.0], t_eval=t_eval_demo, args=(beta_demo, gamma_demo, N_demo))
sol_seir = solve_ivp(seir_rhs, (0.0, 250.0), [N_demo - I0_demo, 0.0, I0_demo, 0.0], t_eval=t_eval_demo, args=(beta_demo, sigma_demo, gamma_demo, N_demo))

I_sir = sol_sir.y[1]
I_seir = sol_seir.y[2]
total_seir = sol_seir.y.sum(axis=0)

print(f"SIR : ピーク {int(t_eval_demo[I_sir.argmax()])} 日目，{I_sir.max():.0f} 人，最終回復者 {sol_sir.y[2][-1]:.0f} 人")
print(f"SEIR: ピーク {int(t_eval_demo[I_seir.argmax()])} 日目，{I_seir.max():.0f} 人，最終回復者 {sol_seir.y[3][-1]:.0f} 人")
print(f"SEIR の S+E+I+R-N の最大のずれ: {np.max(np.abs(total_seir - N_demo)):.2e} 人")

fig, ax = plt.subplots(figsize=(8, 4.5))
ax.plot(t_eval_demo, I_sir, label="SIR: I(t)")
ax.plot(t_eval_demo, I_seir, linestyle="--", label="SEIR: I(t) (latent period 3 days)")
ax.plot(t_eval_demo, sol_seir.y[1], linestyle=":", label="SEIR: E(t)")
ax.set_title(f"SIR vs. SEIR (beta = {beta_demo}, gamma = {gamma_demo}, N = {N_demo:.0f})")
ax.set_xlabel("Time [day]")
ax.set_ylabel("Number of persons")
ax.grid(True)
ax.legend()
fig.tight_layout()
fig.savefig(FIGURE_DIR / "sir_vs_seir.png", dpi=150)
plt.show()
```

同じ $\beta$，$\gamma$ でも，潜伏期間を入れると流行のピークは遅れ，低くなる．
最終的な回復者数はほとんど変わらない．
流行の規模は $R_0 = \beta / \gamma$ で決まり，潜伏期間は主に速さを変えるためである．
第11回の残差で見た「モデルのピークが観測より早い」という偏りは，潜伏期間を入れることで一部説明できる可能性がある．

````{note} 演習3：SIRモデルの拡張案を作る

上の表から要因を1つ選び（SEIR以外），次を`README.md`の「演習3」に書く．

1. 状態遷移図．区画を四角，流れを矢印で描き，各矢印に流れの式を添える．手描きの写真でもよい
2. 微分方程式．追加した状態変数とパラメタに意味と単位を付ける
3. 保存則が成り立つか．成り立たない場合（出生と死亡など）は，総人口の式 $N'$ がどうなるかを書く
4. 追加したパラメタを，データから推定できるか，外部の知識で固定すべきか，どちらかを理由とともに述べる
5. この拡張で，第7波の残差のどの偏りが説明できそうか

時間があれば，右辺の関数を実装して`solve_ivp`で解き，SIRと同じ図に重ねる．
````

## 複雑化の利点と不利益

拡張すれば当てはまりは改善しやすい．
しかし複雑化には代償がある．

| 観点 | 単純なモデル | 複雑なモデル |
| --- | --- | --- |
| 訓練期間の当てはまり | 限界がある | パラメタが多いほど改善する |
| 検証期間の予測 | 構造が合っていれば安定する | 過学習すると悪化する |
| パラメタの推定 | 少数で安定しやすい | 識別できない組が生じ，初期値依存性が増す |
| 説明のしやすさ | 各項の意味が明確 | どの項が結果を決めているか分かりにくい |
| 必要なデータ | 少なくてよい | 区画ごとの観測量が必要になることが多い |
| 数値計算 | 速い | 状態変数が増え，硬い方程式になることもある |

どこまで複雑にするかは，モデルの目的で決まる．
流行の規模の目安を知りたいだけならSIRで足りることが多い．
対策の時期を決めたいなら，潜伏期間や行動変容を入れる必要がある．
第13回で自分の題材を選ぶときも，「何を答えたいか」を先に決め，それに必要な最小限の要素からモデルを始める．

## モデルの限界と改善の問い

今回の手順にも限界がある．

- 検証期間は1つしか取っていない．分割点を変えると結論が変わることがある（演習1）．複数の分割で確かめる方法（交差検証）は発展事項である
- RMSEは観測値の大きさに依存する．流行の減少局面のように値が小さい期間では，RMSEが小さくても相対的な誤差は大きいことがある．目的に応じて相対誤差や対数スケールでの誤差も見る
- 検証期間で良かったモデルが，将来も良いとは限らない．構造が変わる出来事（新しい変異株，政策の転換）が起きれば，どのモデルも外れる
- モデル比較は「候補の中で相対的に良いもの」を選ぶ手続きであり，正しいモデルを見つける手続きではない

## まとめ

- 誤差には，構造による誤差，パラメタ推定による誤差，観測誤差，数値誤差の4種類がある．数値誤差は計算で，推定誤差はデータと方法で減らせるが，構造による誤差は仮定を変えないと消えない
- 残差の時系列に，同じ符号が続く期間や広がる傾向が見えたら，構造による誤差を疑う
- モデルの妥当性は，推定に使わなかった検証期間の誤差で判断する．訓練期間の当てはまりは，複雑にすれば必ず良くなる
- 多項式の例が示すように，過学習したモデルは訓練期間を完璧に通り，検証期間で破綻する
- 当てはまりが同じでも，パラメタの意味は違い得る．外部の知識，パラメタの意味，残差の偏りを合わせて判断する
- SIRモデルの拡張は，足りない要因を状態遷移図に描き，流れを式にすることで作れる．複雑化は当てはまりを改善するが，識別可能性，説明のしやすさ，必要なデータの面で代償がある

## 課題

````{warning} 課題1：拡張モデルの実装と比較

演習3で作った拡張案（またはSEIRモデル）について，次を行う．

1. 右辺の関数を実装し，第11回と同じ第7波のデータに当てはめる．追加したパラメタは，推定するか，出典を明記して外部の値で固定する．
2. 第11回のモデルB（$\gamma = 1/7$ 固定，$N_{\mathrm{eff}}$ 推定）と，訓練期間（最初の60%）と検証期間（残り40%）のRMSEを表で比較する．
3. 観測値，2つのモデル，2つのモデルの残差を図にし，`reports/figures/`に保存する．
4. 拡張によって残差の偏りが減ったか，パラメタの推定は安定していたか（初期値を2通り変えて確かめる），追加したパラメタの推定値は現象として妥当かを，それぞれ2〜3行で書く．
````

````{warning} 課題2：複雑化の判断

次の主張について，賛成か反対かを立場を決めて300字程度で論じる．

「パラメタを増やしてRMSEが下がったのだから，拡張モデルのほうが良いモデルである．」

論じる際は，訓練誤差と検証誤差の違い，識別可能性，モデルの目的，の3つの観点を必ず使う．
人口データの多項式の例，またはSIRの3モデルの比較表を根拠として引く．

`README.md`とNotebookと図をまとめて，WebClassの指示に従って提出する．
````

## 次回への接続

第13回は休講とし，各自が講義ノートを読んで最終レポートの計画書を作成する回である．
第13回のノートには，題材の選び方，実現可能性の点検項目，計画書の書式，最終レポートの構成と評価基準を載せる．
今回学んだ「検証期間を残す」「残差の偏りを読む」「複雑化の代償を考える」は，最終レポートの評価基準にそのまま含まれる．
自分の題材について，どのデータを検証用に残すか，どの誤差の種類が大きそうかを，今のうちに考え始めておく．

## 自分の言葉で説明する問い

1. 誤差の4つの種類を挙げ，それぞれを減らすために何ができるか，またはできないかを説明せよ．
2. 訓練期間と検証期間を分ける理由を，過学習という言葉を使って説明せよ．
3. RMSEがほぼ同じ3つのSIRモデルのうち，どれを選ぶべきか．当てはまり以外に何を根拠にするかを述べよ．
4. SIRモデルに要因を1つ加えるとき，何が改善し，何が悪化し得るか．自分が演習3で選んだ要因を例に説明せよ．
